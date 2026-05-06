"""Auth module: users + sessions sobre el mismo SQLite que CalculatorStorage.

Sin dependencias externas: hash con pbkdf2_hmac (stdlib), tokens con secrets.
Sesion via cookie HTTP-only `monitor_session=<token>`.
"""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import threading
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Constantes
PBKDF2_ITERATIONS = 200_000
SESSION_TTL = timedelta(days=30)
SESSION_COOKIE = "monitor_session"

ADMIN_USERNAME = "agusadmin"
ADMIN_BOOTSTRAP_PASSWORD = "bachicha"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _hash_password(password: str, salt: bytes | None = None) -> str:
    """Devuelve un string `salt_hex$hash_hex` listo para guardar."""
    if salt is None:
        salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{salt.hex()}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, hash_hex = stored.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return secrets.compare_digest(dk.hex(), hash_hex)


@dataclass
class User:
    id: int
    username: str
    role: str          # "admin" | "user"
    is_active: bool
    created_at: str
    updated_at: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class Session:
    token: str
    user_id: int
    username: str
    role: str
    created_at: str
    last_seen_at: str
    expires_at: str
    user_agent: str | None
    ip: str | None


class AuthStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self._lock = threading.Lock()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn, conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    user_agent TEXT,
                    ip TEXT,
                    FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE
                )
                """
            )
        self._bootstrap_admin()

    def _bootstrap_admin(self) -> None:
        """Crea agusadmin/bachicha si no existe ningun admin."""
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS c FROM auth_users WHERE role='admin'"
            ).fetchone()
            if row and row["c"] > 0:
                return
            now = _now_iso()
            conn.execute(
                """
                INSERT OR IGNORE INTO auth_users
                (username, password_hash, role, is_active, created_at, updated_at)
                VALUES (?, ?, 'admin', 1, ?, ?)
                """,
                (ADMIN_USERNAME, _hash_password(ADMIN_BOOTSTRAP_PASSWORD), now, now),
            )
            conn.commit()

    # ---------- Users CRUD ----------
    def list_users(self) -> list[User]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT id, username, role, is_active, created_at, updated_at "
                "FROM auth_users ORDER BY username COLLATE NOCASE"
            ).fetchall()
        return [
            User(
                id=r["id"], username=r["username"], role=r["role"],
                is_active=bool(r["is_active"]),
                created_at=r["created_at"], updated_at=r["updated_at"],
            ) for r in rows
        ]

    def get_user_by_username(self, username: str) -> User | None:
        with closing(self._connect()) as conn:
            r = conn.execute(
                "SELECT id, username, role, is_active, created_at, updated_at "
                "FROM auth_users WHERE username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
        if not r:
            return None
        return User(
            id=r["id"], username=r["username"], role=r["role"],
            is_active=bool(r["is_active"]),
            created_at=r["created_at"], updated_at=r["updated_at"],
        )

    def authenticate(self, username: str, password: str) -> User | None:
        with closing(self._connect()) as conn:
            r = conn.execute(
                "SELECT id, username, role, is_active, password_hash, created_at, updated_at "
                "FROM auth_users WHERE username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
        if not r or not r["is_active"]:
            return None
        if not _verify_password(password, r["password_hash"]):
            return None
        return User(
            id=r["id"], username=r["username"], role=r["role"],
            is_active=bool(r["is_active"]),
            created_at=r["created_at"], updated_at=r["updated_at"],
        )

    def create_user(self, username: str, password: str, role: str = "user") -> User:
        username = username.strip()
        if not username:
            raise ValueError("Usuario vacio")
        if len(password) < 4:
            raise ValueError("Password muy corto (>=4)")
        if role not in ("admin", "user"):
            raise ValueError("Role invalido")
        now = _now_iso()
        with closing(self._connect()) as conn, conn:
            try:
                cur = conn.execute(
                    "INSERT INTO auth_users (username, password_hash, role, is_active, created_at, updated_at) "
                    "VALUES (?, ?, ?, 1, ?, ?)",
                    (username, _hash_password(password), role, now, now),
                )
            except sqlite3.IntegrityError:
                raise ValueError("Usuario ya existe")
            uid = cur.lastrowid
        u = self.get_user_by_username(username)
        if u is None:
            # No deberia pasar pero tipamos defensivo
            return User(id=uid, username=username, role=role, is_active=True,
                        created_at=now, updated_at=now)
        return u

    def update_user(self, user_id: int, *,
                    password: str | None = None,
                    role: str | None = None,
                    is_active: bool | None = None,
                    new_username: str | None = None) -> User | None:
        sets, vals = [], []
        if password is not None:
            if len(password) < 4:
                raise ValueError("Password muy corto (>=4)")
            sets.append("password_hash = ?")
            vals.append(_hash_password(password))
        if role is not None:
            if role not in ("admin", "user"):
                raise ValueError("Role invalido")
            sets.append("role = ?")
            vals.append(role)
        if is_active is not None:
            sets.append("is_active = ?")
            vals.append(1 if is_active else 0)
        if new_username is not None:
            new_username = new_username.strip()
            if not new_username:
                raise ValueError("Usuario vacio")
            sets.append("username = ?")
            vals.append(new_username)
        if not sets:
            return self._get_user_by_id(user_id)
        sets.append("updated_at = ?")
        vals.append(_now_iso())
        vals.append(user_id)
        with closing(self._connect()) as conn, conn:
            try:
                conn.execute(f"UPDATE auth_users SET {', '.join(sets)} WHERE id = ?", vals)
            except sqlite3.IntegrityError:
                raise ValueError("Usuario duplicado")
        return self._get_user_by_id(user_id)

    def _get_user_by_id(self, user_id: int) -> User | None:
        with closing(self._connect()) as conn:
            r = conn.execute(
                "SELECT id, username, role, is_active, created_at, updated_at "
                "FROM auth_users WHERE id = ?",
                (user_id,),
            ).fetchone()
        if not r:
            return None
        return User(
            id=r["id"], username=r["username"], role=r["role"],
            is_active=bool(r["is_active"]),
            created_at=r["created_at"], updated_at=r["updated_at"],
        )

    def delete_user(self, user_id: int) -> bool:
        with closing(self._connect()) as conn, conn:
            cur = conn.execute("DELETE FROM auth_users WHERE id = ?", (user_id,))
            conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", (user_id,))
        return cur.rowcount > 0

    # ---------- Sessions ----------
    def create_session(self, user_id: int, user_agent: str | None, ip: str | None) -> str:
        token = secrets.token_urlsafe(32)
        now = _now()
        expires = now + SESSION_TTL
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "INSERT INTO auth_sessions (token, user_id, created_at, last_seen_at, expires_at, user_agent, ip) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (token, user_id, now.isoformat(), now.isoformat(), expires.isoformat(),
                 user_agent, ip),
            )
        return token

    def get_session_user(self, token: str | None, user_agent: str | None = None,
                         ip: str | None = None, touch: bool = True) -> User | None:
        if not token:
            return None
        with closing(self._connect()) as conn:
            r = conn.execute(
                "SELECT s.token, s.user_id, s.expires_at, "
                "u.username, u.role, u.is_active, u.created_at as u_created, u.updated_at as u_updated "
                "FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id "
                "WHERE s.token = ?",
                (token,),
            ).fetchone()
        if not r:
            return None
        try:
            expires = datetime.fromisoformat(r["expires_at"])
        except ValueError:
            return None
        if expires <= _now() or not r["is_active"]:
            return None
        if touch:
            with closing(self._connect()) as conn, conn:
                conn.execute(
                    "UPDATE auth_sessions SET last_seen_at = ? WHERE token = ?",
                    (_now_iso(), token),
                )
        return User(
            id=r["user_id"], username=r["username"], role=r["role"],
            is_active=bool(r["is_active"]),
            created_at=r["u_created"], updated_at=r["u_updated"],
        )

    def delete_session(self, token: str) -> None:
        with closing(self._connect()) as conn, conn:
            conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))

    def list_sessions(self) -> list[Session]:
        # Limpia expiradas
        with closing(self._connect()) as conn, conn:
            conn.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (_now_iso(),))
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT s.token, s.user_id, s.created_at, s.last_seen_at, s.expires_at, "
                "s.user_agent, s.ip, u.username, u.role "
                "FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id "
                "ORDER BY s.last_seen_at DESC"
            ).fetchall()
        return [
            Session(
                token=r["token"], user_id=r["user_id"],
                username=r["username"], role=r["role"],
                created_at=r["created_at"], last_seen_at=r["last_seen_at"],
                expires_at=r["expires_at"],
                user_agent=r["user_agent"], ip=r["ip"],
            ) for r in rows
        ]
