from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from backend.time_utils import now_argentina_iso


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


class CalculatorStorage:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
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

    def list_lecaps(self) -> list[SavedLecap]:
        with self._connect() as connection:
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
        with self._connect() as connection:
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

    def delete_lecap(self, item_id: int) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM lecap_calculators WHERE id = ?",
                (item_id,),
            )
        return cursor.rowcount > 0

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

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
