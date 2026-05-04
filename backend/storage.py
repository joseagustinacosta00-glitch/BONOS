from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from backend.time_utils import now_argentina_iso


HISTORICAL_METRIC_TYPES = (
    "parity",
    "dirty_price",
    "clean_price",
    "ytm",
    "tem",
    "tna",
    "volume",
)


@dataclass(frozen=True)
class SavedLecap:
    id: int
    ticker: str
    issue_date: date
    maturity_date: date
    face_value: float
    tem_emission_percent: float
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "ticker": self.ticker,
            "issue_date": self.issue_date.isoformat(),
            "maturity_date": self.maturity_date.isoformat(),
            "face_value": self.face_value,
            "tem_emission_percent": self.tem_emission_percent,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass(frozen=True)
class SavedCashflow:
    id: int
    calculator_type: str
    ticker: str
    cashflow_number: int
    payment_date: date
    effective_payment_date: date
    applicable_days: int
    amortization_vn: float
    amortization_vr: float
    applicable_rate: float
    interest: float
    total: float
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "calculator_type": self.calculator_type,
            "ticker": self.ticker,
            "cashflow_number": self.cashflow_number,
            "payment_date": self.payment_date.isoformat(),
            "effective_payment_date": self.effective_payment_date.isoformat(),
            "applicable_days": self.applicable_days,
            "amortization_vn": self.amortization_vn,
            "amortization_vr": self.amortization_vr,
            "applicable_rate": self.applicable_rate,
            "interest": self.interest,
            "total": self.total,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass(frozen=True)
class HistoricalDataPoint:
    id: int
    ticker: str
    metric_type: str
    price_market: str
    settlement_type: str
    value_date: date
    value: float
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "ticker": self.ticker,
            "metric_type": self.metric_type,
            "price_market": self.price_market,
            "settlement_type": self.settlement_type,
            "value_date": self.value_date.isoformat(),
            "value": self.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass(frozen=True)
class SavedBondHd:
    id: int
    ticker: str
    issue_date: date
    maturity_date: date
    face_value: float
    bond_type: str
    frequency: str
    convention: str
    payload_json: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, object]:
        import json
        try:
            payload = json.loads(self.payload_json) if self.payload_json else {}
        except (TypeError, ValueError):
            payload = {}
        return {
            "id": self.id,
            "ticker": self.ticker,
            "issue_date": self.issue_date.isoformat(),
            "maturity_date": self.maturity_date.isoformat(),
            "face_value": self.face_value,
            "bond_type": self.bond_type,
            "frequency": self.frequency,
            "convention": self.convention,
            "payload": payload,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass(frozen=True)
class AiMemoryNote:
    id: int
    title: str
    category: str
    content: str
    tags: str
    is_active: bool
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "content": self.content,
            "tags": self.tags,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class CalculatorStorage:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS lecap_calculators (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL UNIQUE,
                    issue_date TEXT NOT NULL,
                    maturity_date TEXT NOT NULL,
                    face_value REAL NOT NULL,
                    tem_emission_percent REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS calculator_cashflows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    calculator_type TEXT NOT NULL,
                    ticker TEXT NOT NULL,
                    cashflow_number INTEGER NOT NULL,
                    payment_date TEXT NOT NULL,
                    effective_payment_date TEXT NOT NULL,
                    applicable_days INTEGER NOT NULL,
                    amortization_vn REAL NOT NULL,
                    amortization_vr REAL NOT NULL,
                    applicable_rate REAL NOT NULL,
                    interest REAL NOT NULL,
                    total REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(calculator_type, ticker, cashflow_number)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS historical_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL,
                    metric_type TEXT NOT NULL,
                    price_market TEXT NOT NULL DEFAULT 'unspecified',
                    settlement_type TEXT NOT NULL DEFAULT 'unspecified',
                    value_date TEXT NOT NULL,
                    value REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(ticker, metric_type, price_market, settlement_type, value_date)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS bond_hd_calculations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL UNIQUE,
                    issue_date TEXT NOT NULL,
                    maturity_date TEXT NOT NULL,
                    face_value REAL NOT NULL,
                    bond_type TEXT NOT NULL,
                    frequency TEXT NOT NULL,
                    convention TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_memory_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._migrate_historical_data(connection)

    def list_lecaps(self) -> list[SavedLecap]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                """
                SELECT id, ticker, issue_date, maturity_date, face_value,
                       tem_emission_percent, created_at, updated_at
                FROM lecap_calculators
                ORDER BY maturity_date ASC, ticker ASC
                """
            ).fetchall()
        return [self._row_to_lecap(row) for row in rows]

    def upsert_lecap(
        self,
        ticker: str,
        issue_date: date,
        maturity_date: date,
        face_value: float,
        tem_emission_percent: float,
    ) -> SavedLecap:
        now = now_argentina_iso()
        ticker = ticker.upper().strip()
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                INSERT INTO lecap_calculators (
                    ticker, issue_date, maturity_date, face_value,
                    tem_emission_percent, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker) DO UPDATE SET
                    issue_date = excluded.issue_date,
                    maturity_date = excluded.maturity_date,
                    face_value = excluded.face_value,
                    tem_emission_percent = excluded.tem_emission_percent,
                    updated_at = excluded.updated_at
                """,
                (
                    ticker,
                    issue_date.isoformat(),
                    maturity_date.isoformat(),
                    face_value,
                    tem_emission_percent,
                    now,
                    now,
                ),
            )
            row = connection.execute(
                """
                SELECT id, ticker, issue_date, maturity_date, face_value,
                       tem_emission_percent, created_at, updated_at
                FROM lecap_calculators
                WHERE ticker = ?
                """,
                (ticker,),
            ).fetchone()
        if row is None:
            raise RuntimeError("No se pudo guardar la LECAP.")
        return self._row_to_lecap(row)

    def upsert_cashflows(
        self,
        calculator_type: str,
        ticker: str,
        cashflows: list[dict[str, object]],
    ) -> None:
        now = now_argentina_iso()
        calculator_type = calculator_type.lower().strip()
        ticker = ticker.upper().strip()
        with closing(self._connect()) as connection, connection:
            for cashflow in cashflows:
                connection.execute(
                    """
                    INSERT INTO calculator_cashflows (
                        calculator_type, ticker, cashflow_number, payment_date,
                        effective_payment_date, applicable_days, amortization_vn,
                        amortization_vr, applicable_rate, interest, total,
                        created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(calculator_type, ticker, cashflow_number) DO UPDATE SET
                        payment_date = excluded.payment_date,
                        effective_payment_date = excluded.effective_payment_date,
                        applicable_days = excluded.applicable_days,
                        amortization_vn = excluded.amortization_vn,
                        amortization_vr = excluded.amortization_vr,
                        applicable_rate = excluded.applicable_rate,
                        interest = excluded.interest,
                        total = excluded.total,
                        updated_at = excluded.updated_at
                    """,
                    (
                        calculator_type,
                        ticker,
                        int(cashflow["number"]),
                        str(cashflow["payment_date"]),
                        str(cashflow["effective_payment_date"]),
                        int(cashflow["applicable_days"]),
                        float(cashflow["amortization_vn"]),
                        float(cashflow["amortization_vr"]),
                        float(cashflow["applicable_rate"]),
                        float(cashflow["interest"]),
                        float(cashflow["total"]),
                        now,
                        now,
                    ),
                )

    def list_cashflows(self, calculator_type: str | None = None, ticker: str | None = None) -> list[SavedCashflow]:
        filters = []
        params: list[object] = []
        if calculator_type:
            filters.append("calculator_type = ?")
            params.append(calculator_type.lower().strip())
        if ticker:
            filters.append("ticker = ?")
            params.append(ticker.upper().strip())
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        with closing(self._connect()) as connection:
            rows = connection.execute(
                f"""
                SELECT id, calculator_type, ticker, cashflow_number, payment_date,
                       effective_payment_date, applicable_days, amortization_vn,
                       amortization_vr, applicable_rate, interest, total,
                       created_at, updated_at
                FROM calculator_cashflows
                {where}
                ORDER BY ticker ASC, cashflow_number ASC
                """,
                params,
            ).fetchall()
        return [self._row_to_cashflow(row) for row in rows]

    def list_tickers(self) -> list[str]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                """
                SELECT ticker AS ticker FROM lecap_calculators
                UNION
                SELECT ticker AS ticker FROM calculator_cashflows
                UNION
                SELECT ticker AS ticker FROM historical_data
                ORDER BY ticker ASC
                """
            ).fetchall()
        return sorted({_normalize_base_ticker(str(row["ticker"])) for row in rows})

    def upsert_historical_data(
        self,
        ticker: str,
        metric_type: str,
        value_date: date,
        value: float,
        price_market: str = "unspecified",
        settlement_type: str = "unspecified",
    ) -> tuple[HistoricalDataPoint, bool]:
        now = now_argentina_iso()
        ticker = _normalize_base_ticker(ticker)
        metric_type = metric_type.lower().strip()
        price_market = price_market.lower().strip()
        settlement_type = settlement_type.lower().replace("+", "").strip()
        if metric_type not in HISTORICAL_METRIC_TYPES:
            raise ValueError("Tipo de dato historico no soportado.")
        with closing(self._connect()) as connection, connection:
            exists = connection.execute(
                """
                SELECT 1
                FROM historical_data
                WHERE ticker = ? AND metric_type = ? AND price_market = ?
                  AND settlement_type = ? AND value_date = ?
                """,
                (ticker, metric_type, price_market, settlement_type, value_date.isoformat()),
            ).fetchone() is not None
            connection.execute(
                """
                INSERT INTO historical_data (
                    ticker, metric_type, price_market, settlement_type,
                    value_date, value, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker, metric_type, price_market, settlement_type, value_date) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (ticker, metric_type, price_market, settlement_type, value_date.isoformat(), value, now, now),
            )
            row = connection.execute(
                """
                SELECT id, ticker, metric_type, price_market, settlement_type,
                       value_date, value, created_at, updated_at
                FROM historical_data
                WHERE ticker = ? AND metric_type = ? AND price_market = ?
                  AND settlement_type = ? AND value_date = ?
                """,
                (ticker, metric_type, price_market, settlement_type, value_date.isoformat()),
            ).fetchone()
        if row is None:
            raise RuntimeError("No se pudo guardar el dato historico.")
        point = self._row_to_historical_data(row)
        return point, exists

    def list_historical_data(
        self,
        ticker: str | None = None,
        metric_type: str | None = None,
        price_market: str | None = None,
        settlement_type: str | None = None,
        limit: int = 500,
    ) -> list[HistoricalDataPoint]:
        filters = []
        params: list[object] = []
        if ticker:
            base_ticker = _normalize_base_ticker(ticker)
            filters.append("ticker IN (?, ?, ?)")
            params.extend([base_ticker, f"{base_ticker}D", f"{base_ticker}C"])
        if metric_type:
            filters.append("metric_type = ?")
            params.append(metric_type.lower().strip())
        if price_market:
            filters.append("price_market = ?")
            params.append(price_market.lower().strip())
        if settlement_type:
            filters.append("settlement_type = ?")
            params.append(settlement_type.lower().replace("+", "").strip())
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        with closing(self._connect()) as connection:
            rows = connection.execute(
                f"""
                SELECT id, ticker, metric_type, price_market, settlement_type,
                       value_date, value, created_at, updated_at
                FROM historical_data
                {where}
                ORDER BY value_date DESC, ticker ASC, metric_type ASC
                LIMIT ?
                """,
                [*params, limit],
            ).fetchall()
        return [self._row_to_historical_data(row) for row in rows]

    def list_historical_series(self) -> list[dict[str, object]]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                """
                SELECT ticker, metric_type, price_market, settlement_type, COUNT(*) AS count,
                       MIN(value_date) AS first_date,
                       MAX(value_date) AS last_date
                FROM historical_data
                GROUP BY ticker, metric_type, price_market, settlement_type
                ORDER BY ticker ASC, metric_type ASC, price_market ASC, settlement_type ASC
                """
            ).fetchall()
        series: dict[tuple[str, str, str, str], dict[str, object]] = {}
        for row in rows:
            key = (
                _normalize_base_ticker(str(row["ticker"])),
                str(row["metric_type"]),
                str(row["price_market"]),
                str(row["settlement_type"]),
            )
            current = series.get(key)
            if current is None:
                series[key] = {
                    "ticker": key[0],
                    "metric_type": key[1],
                    "price_market": key[2],
                    "settlement_type": key[3],
                    "count": int(row["count"]),
                    "first_date": str(row["first_date"]),
                    "last_date": str(row["last_date"]),
                }
                continue
            current["count"] = int(current["count"]) + int(row["count"])
            current["first_date"] = min(str(current["first_date"]), str(row["first_date"]))
            current["last_date"] = max(str(current["last_date"]), str(row["last_date"]))
        return sorted(
            series.values(),
            key=lambda item: (
                str(item["ticker"]),
                str(item["metric_type"]),
                str(item["price_market"]),
                str(item["settlement_type"]),
            ),
        )

    def delete_lecap(self, item_id: int) -> bool:
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute(
                "DELETE FROM lecap_calculators WHERE id = ?",
                (item_id,),
            )
        return cursor.rowcount > 0

    def create_ai_memory_note(
        self,
        title: str,
        category: str,
        content: str,
        tags: str | None = None,
    ) -> AiMemoryNote:
        now = now_argentina_iso()
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute(
                """
                INSERT INTO ai_memory_notes (title, category, content, tags, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                """,
                (title.strip(), category.strip(), content.strip(), (tags or "").strip(), now, now),
            )
            row = connection.execute(
                """
                SELECT id, title, category, content, tags, is_active, created_at, updated_at
                FROM ai_memory_notes
                WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
        if row is None:
            raise RuntimeError("No se pudo guardar la memoria tecnica.")
        return self._row_to_ai_memory_note(row)

    def list_ai_memory_notes(
        self,
        category: str | None = None,
        search: str | None = None,
        include_inactive: bool = False,
        limit: int = 200,
    ) -> list[AiMemoryNote]:
        filters = []
        params: list[object] = []
        if not include_inactive:
            filters.append("is_active = 1")
        if category:
            filters.append("category = ?")
            params.append(category.strip())
        if search:
            filters.append("(title LIKE ? OR content LIKE ? OR tags LIKE ?)")
            needle = f"%{search.strip()}%"
            params.extend([needle, needle, needle])
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        with closing(self._connect()) as connection:
            rows = connection.execute(
                f"""
                SELECT id, title, category, content, tags, is_active, created_at, updated_at
                FROM ai_memory_notes
                {where}
                ORDER BY updated_at DESC, id DESC
                LIMIT ?
                """,
                [*params, limit],
            ).fetchall()
        return [self._row_to_ai_memory_note(row) for row in rows]

    def get_ai_memory_note(self, note_id: int) -> AiMemoryNote | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                """
                SELECT id, title, category, content, tags, is_active, created_at, updated_at
                FROM ai_memory_notes
                WHERE id = ?
                """,
                (note_id,),
            ).fetchone()
        return self._row_to_ai_memory_note(row) if row else None

    def update_ai_memory_note(
        self,
        note_id: int,
        title: str | None = None,
        category: str | None = None,
        content: str | None = None,
        tags: str | None = None,
        is_active: bool | None = None,
    ) -> AiMemoryNote | None:
        current = self.get_ai_memory_note(note_id)
        if current is None:
            return None
        now = now_argentina_iso()
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                UPDATE ai_memory_notes
                SET title = ?, category = ?, content = ?, tags = ?, is_active = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    (title if title is not None else current.title).strip(),
                    (category if category is not None else current.category).strip(),
                    (content if content is not None else current.content).strip(),
                    (tags if tags is not None else current.tags).strip(),
                    1 if (is_active if is_active is not None else current.is_active) else 0,
                    now,
                    note_id,
                ),
            )
        return self.get_ai_memory_note(note_id)

    def deactivate_ai_memory_note(self, note_id: int) -> bool:
        updated = self.update_ai_memory_note(note_id, is_active=False)
        return updated is not None

    def search_ai_memory_notes(self, query: str, category: str | None = None) -> list[AiMemoryNote]:
        return self.list_ai_memory_notes(category=category, search=query, include_inactive=False, limit=50)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def backup_to(self, target_path: Path) -> Path:
        """Crea una copia consistente de la base SQLite usando la API oficial
        sqlite3.backup. Es seguro hacerlo aunque la app este escribiendo."""
        target = Path(target_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not self.db_path.exists():
            raise FileNotFoundError(f"No existe la base origen: {self.db_path}")
        with closing(sqlite3.connect(self.db_path)) as source, closing(sqlite3.connect(target)) as dest:
            source.backup(dest)
        return target

    def restore_from(self, source_path: Path) -> Path:
        """Reemplaza la base actual con el archivo source. Hace un backup
        defensivo de la base previa antes de pisarla."""
        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"No existe el archivo a restaurar: {source}")
        # Backup defensivo de la base actual antes de pisar
        if self.db_path.exists():
            from datetime import datetime
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            pre_restore = self.db_path.parent / "backups" / f"pre_restore_{stamp}.db"
            try:
                self.backup_to(pre_restore)
            except Exception:
                pass
        # Validar que el archivo origen sea SQLite valido
        with closing(sqlite3.connect(source)) as test:
            test.execute("SELECT 1")
        # Reemplazar
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy2(source, self.db_path)
        return self.db_path

    def auto_backup(self, retention: int = 30) -> Path | None:
        """Crea un backup en data/backups/ con timestamp y rota los mas viejos."""
        if not self.db_path.exists():
            return None
        from datetime import datetime
        backups_dir = self.db_path.parent / "backups"
        backups_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target = backups_dir / f"user_data_{stamp}.db"
        self.backup_to(target)
        # Rotacion: mantener los ultimos N
        existing = sorted(backups_dir.glob("user_data_*.db"))
        if len(existing) > retention:
            for old in existing[:-retention]:
                try:
                    old.unlink()
                except OSError:
                    pass
        return target

    def list_backups(self) -> list[dict[str, object]]:
        backups_dir = self.db_path.parent / "backups"
        if not backups_dir.exists():
            return []
        items = []
        for path in sorted(backups_dir.glob("*.db"), reverse=True):
            try:
                stat = path.stat()
            except OSError:
                continue
            items.append({
                "name": path.name,
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            })
        return items

    def get_db_info(self) -> dict:
        """Resumen del estado fisico de la base SQLite."""
        info: dict[str, object] = {
            "path": str(self.db_path),
            "absolute_path": str(self.db_path.resolve()) if self.db_path.exists() else None,
            "exists": self.db_path.exists(),
            "size_bytes": 0,
            "writable": False,
        }
        if self.db_path.exists():
            try:
                info["size_bytes"] = self.db_path.stat().st_size
            except OSError:
                pass
        try:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            test_path = self.db_path.parent / ".write_test"
            test_path.write_text("ok")
            test_path.unlink()
            info["writable"] = True
        except OSError as exc:
            info["writable"] = False
            info["write_error"] = str(exc)
        info["tables"] = self.get_table_counts()
        backups_dir = self.db_path.parent / "backups"
        backup_count = 0
        backup_total_size = 0
        latest_backup = None
        if backups_dir.exists():
            for path in sorted(backups_dir.glob("*.db")):
                try:
                    backup_count += 1
                    backup_total_size += path.stat().st_size
                    latest_backup = path.name
                except OSError:
                    continue
        info["backups"] = {
            "count": backup_count,
            "total_size_bytes": backup_total_size,
            "latest": latest_backup,
            "directory": str(backups_dir),
        }
        return info

    def get_table_counts(self) -> dict[str, int]:
        if not self.db_path.exists():
            return {}
        counts: dict[str, int] = {}
        with closing(self._connect()) as connection:
            for table in (
                "lecap_calculators",
                "calculator_cashflows",
                "historical_data",
                "bond_hd_calculations",
                "ai_memory_notes",
            ):
                try:
                    row = connection.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()
                    counts[table] = int(row["c"])
                except sqlite3.Error:
                    counts[table] = -1
        return counts

    def export_all_json(self) -> dict:
        """Exporta TODAS las tablas relevantes a un dict JSON-serializable.
        Util como backup portable independiente del binario SQLite."""
        with closing(self._connect()) as connection:
            data: dict[str, list[dict]] = {}
            for table in ("lecap_calculators", "calculator_cashflows", "historical_data",
                          "bond_hd_calculations", "ai_memory_notes"):
                try:
                    rows = connection.execute(f"SELECT * FROM {table}").fetchall()
                    data[table] = [dict(row) for row in rows]
                except sqlite3.Error:
                    data[table] = []
        from datetime import datetime
        return {
            "version": 1,
            "generated_at": datetime.now().isoformat(),
            "tables": data,
        }

    @staticmethod
    def _migrate_historical_data(connection: sqlite3.Connection) -> None:
        columns = {
            str(row["name"])
            for row in connection.execute("PRAGMA table_info(historical_data)").fetchall()
        }
        if {"price_market", "settlement_type"}.issubset(columns):
            return

        connection.execute(
            """
            CREATE TABLE historical_data_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                price_market TEXT NOT NULL DEFAULT 'unspecified',
                settlement_type TEXT NOT NULL DEFAULT 'unspecified',
                value_date TEXT NOT NULL,
                value REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(ticker, metric_type, price_market, settlement_type, value_date)
            )
            """
        )
        connection.execute(
            """
            INSERT OR REPLACE INTO historical_data_new (
                id, ticker, metric_type, price_market, settlement_type,
                value_date, value, created_at, updated_at
            )
            SELECT id, ticker, metric_type, 'unspecified', 'unspecified',
                   value_date, value, created_at, updated_at
            FROM historical_data
            """
        )
        connection.execute("DROP TABLE historical_data")
        connection.execute("ALTER TABLE historical_data_new RENAME TO historical_data")

    @staticmethod
    def _row_to_lecap(row: sqlite3.Row) -> SavedLecap:
        return SavedLecap(
            id=int(row["id"]),
            ticker=str(row["ticker"]),
            issue_date=date.fromisoformat(str(row["issue_date"])),
            maturity_date=date.fromisoformat(str(row["maturity_date"])),
            face_value=float(row["face_value"]),
            tem_emission_percent=float(row["tem_emission_percent"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    @staticmethod
    def _row_to_cashflow(row: sqlite3.Row) -> SavedCashflow:
        return SavedCashflow(
            id=int(row["id"]),
            calculator_type=str(row["calculator_type"]),
            ticker=str(row["ticker"]),
            cashflow_number=int(row["cashflow_number"]),
            payment_date=date.fromisoformat(str(row["payment_date"])),
            effective_payment_date=date.fromisoformat(str(row["effective_payment_date"])),
            applicable_days=int(row["applicable_days"]),
            amortization_vn=float(row["amortization_vn"]),
            amortization_vr=float(row["amortization_vr"]),
            applicable_rate=float(row["applicable_rate"]),
            interest=float(row["interest"]),
            total=float(row["total"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    @staticmethod
    def _row_to_historical_data(row: sqlite3.Row) -> HistoricalDataPoint:
        return HistoricalDataPoint(
            id=int(row["id"]),
            ticker=_normalize_base_ticker(str(row["ticker"])),
            metric_type=str(row["metric_type"]),
            price_market=str(row["price_market"]),
            settlement_type=str(row["settlement_type"]),
            value_date=date.fromisoformat(str(row["value_date"])),
            value=float(row["value"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    def list_bond_hd(self) -> list[SavedBondHd]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                """
                SELECT id, ticker, issue_date, maturity_date, face_value,
                       bond_type, frequency, convention, payload_json,
                       created_at, updated_at
                FROM bond_hd_calculations
                ORDER BY ticker ASC
                """
            ).fetchall()
        return [self._row_to_bond_hd(row) for row in rows]

    def get_bond_hd(self, ticker: str) -> SavedBondHd | None:
        normalized = _normalize_base_ticker(ticker)
        with closing(self._connect()) as connection:
            row = connection.execute(
                """
                SELECT id, ticker, issue_date, maturity_date, face_value,
                       bond_type, frequency, convention, payload_json,
                       created_at, updated_at
                FROM bond_hd_calculations
                WHERE ticker = ?
                """,
                (normalized,),
            ).fetchone()
        return self._row_to_bond_hd(row) if row else None

    def upsert_bond_hd(
        self,
        ticker: str,
        issue_date: date,
        maturity_date: date,
        face_value: float,
        bond_type: str,
        frequency: str,
        convention: str,
        payload_json: str,
    ) -> SavedBondHd:
        now = now_argentina_iso()
        normalized = _normalize_base_ticker(ticker)
        if not normalized:
            raise ValueError("El ticker es obligatorio.")
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                INSERT INTO bond_hd_calculations (
                    ticker, issue_date, maturity_date, face_value,
                    bond_type, frequency, convention, payload_json,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker) DO UPDATE SET
                    issue_date = excluded.issue_date,
                    maturity_date = excluded.maturity_date,
                    face_value = excluded.face_value,
                    bond_type = excluded.bond_type,
                    frequency = excluded.frequency,
                    convention = excluded.convention,
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
                """,
                (
                    normalized,
                    issue_date.isoformat(),
                    maturity_date.isoformat(),
                    face_value,
                    bond_type,
                    frequency,
                    convention,
                    payload_json,
                    now,
                    now,
                ),
            )
            row = connection.execute(
                """
                SELECT id, ticker, issue_date, maturity_date, face_value,
                       bond_type, frequency, convention, payload_json,
                       created_at, updated_at
                FROM bond_hd_calculations
                WHERE ticker = ?
                """,
                (normalized,),
            ).fetchone()
        if row is None:
            raise RuntimeError("No se pudo guardar el Bono HD.")
        return self._row_to_bond_hd(row)

    def delete_bond_hd(self, ticker: str) -> bool:
        normalized = _normalize_base_ticker(ticker)
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute(
                "DELETE FROM bond_hd_calculations WHERE ticker = ?",
                (normalized,),
            )
        return cursor.rowcount > 0

    @staticmethod
    def _row_to_bond_hd(row: sqlite3.Row) -> SavedBondHd:
        return SavedBondHd(
            id=int(row["id"]),
            ticker=str(row["ticker"]),
            issue_date=date.fromisoformat(str(row["issue_date"])),
            maturity_date=date.fromisoformat(str(row["maturity_date"])),
            face_value=float(row["face_value"]),
            bond_type=str(row["bond_type"]),
            frequency=str(row["frequency"]),
            convention=str(row["convention"]),
            payload_json=str(row["payload_json"] or ""),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    @staticmethod
    def _row_to_ai_memory_note(row: sqlite3.Row) -> AiMemoryNote:
        return AiMemoryNote(
            id=int(row["id"]),
            title=str(row["title"]),
            category=str(row["category"]),
            content=str(row["content"]),
            tags=str(row["tags"] or ""),
            is_active=bool(row["is_active"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )


def _normalize_base_ticker(value: str) -> str:
    ticker = value.upper().strip()
    if len(ticker) > 1 and ticker[-1] in {"D", "C"} and any(char.isdigit() for char in ticker[:-1]):
        return ticker[:-1]
    return ticker
