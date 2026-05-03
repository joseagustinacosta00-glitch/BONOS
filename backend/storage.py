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
    value_date: date
    value: float
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "ticker": self.ticker,
            "metric_type": self.metric_type,
            "value_date": self.value_date.isoformat(),
            "value": self.value,
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
                    value_date TEXT NOT NULL,
                    value REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(ticker, metric_type, value_date)
                )
                """
            )

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
                SELECT ticker FROM lecap_calculators
                UNION
                SELECT ticker FROM calculator_cashflows
                UNION
                SELECT ticker FROM historical_data
                ORDER BY ticker ASC
                """
            ).fetchall()
        return [str(row["ticker"]) for row in rows]

    def upsert_historical_data(
        self,
        ticker: str,
        metric_type: str,
        value_date: date,
        value: float,
    ) -> HistoricalDataPoint:
        now = now_argentina_iso()
        ticker = ticker.upper().strip()
        metric_type = metric_type.lower().strip()
        if metric_type not in HISTORICAL_METRIC_TYPES:
            raise ValueError("Tipo de dato historico no soportado.")
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                INSERT INTO historical_data (
                    ticker, metric_type, value_date, value, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker, metric_type, value_date) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (ticker, metric_type, value_date.isoformat(), value, now, now),
            )
            row = connection.execute(
                """
                SELECT id, ticker, metric_type, value_date, value, created_at, updated_at
                FROM historical_data
                WHERE ticker = ? AND metric_type = ? AND value_date = ?
                """,
                (ticker, metric_type, value_date.isoformat()),
            ).fetchone()
        if row is None:
            raise RuntimeError("No se pudo guardar el dato historico.")
        return self._row_to_historical_data(row)

    def list_historical_data(
        self,
        ticker: str | None = None,
        metric_type: str | None = None,
    ) -> list[HistoricalDataPoint]:
        filters = []
        params: list[object] = []
        if ticker:
            filters.append("ticker = ?")
            params.append(ticker.upper().strip())
        if metric_type:
            filters.append("metric_type = ?")
            params.append(metric_type.lower().strip())
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        with closing(self._connect()) as connection:
            rows = connection.execute(
                f"""
                SELECT id, ticker, metric_type, value_date, value, created_at, updated_at
                FROM historical_data
                {where}
                ORDER BY value_date DESC, ticker ASC, metric_type ASC
                LIMIT 500
                """,
                params,
            ).fetchall()
        return [self._row_to_historical_data(row) for row in rows]

    def list_historical_series(self) -> list[dict[str, object]]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                """
                SELECT ticker, metric_type, COUNT(*) AS count,
                       MIN(value_date) AS first_date,
                       MAX(value_date) AS last_date
                FROM historical_data
                GROUP BY ticker, metric_type
                ORDER BY ticker ASC, metric_type ASC
                """
            ).fetchall()
        return [
            {
                "ticker": str(row["ticker"]),
                "metric_type": str(row["metric_type"]),
                "count": int(row["count"]),
                "first_date": str(row["first_date"]),
                "last_date": str(row["last_date"]),
            }
            for row in rows
        ]

    def delete_lecap(self, item_id: int) -> bool:
        with closing(self._connect()) as connection, connection:
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
            ticker=str(row["ticker"]),
            metric_type=str(row["metric_type"]),
            value_date=date.fromisoformat(str(row["value_date"])),
            value=float(row["value"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )
