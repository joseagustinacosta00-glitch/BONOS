from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Iterable, Sequence

logger = logging.getLogger(__name__)

try:
    import asyncpg  # type: ignore
except ImportError:
    asyncpg = None


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS instruments (
    id SERIAL PRIMARY KEY,
    symbol TEXT UNIQUE NOT NULL,
    family TEXT,
    category TEXT NOT NULL,
    currency TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    snapshot_interval_seconds INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_ticks (
    ts TIMESTAMPTZ NOT NULL,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    last NUMERIC(18, 6),
    delta_volume BIGINT NOT NULL DEFAULT 0,
    cumulative_volume BIGINT,
    PRIMARY KEY (ts, instrument_id)
);

CREATE INDEX IF NOT EXISTS idx_market_ticks_instrument_ts
    ON market_ticks (instrument_id, ts DESC);

CREATE TABLE IF NOT EXISTS daily_summary (
    trade_date DATE NOT NULL,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    open NUMERIC(18, 6),
    high NUMERIC(18, 6),
    low NUMERIC(18, 6),
    close NUMERIC(18, 6),
    vwap NUMERIC(18, 6),
    total_amount NUMERIC(24, 6),
    total_volume_nominal BIGINT,
    trades_count INTEGER NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trade_date, instrument_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_instrument_date
    ON daily_summary (instrument_id, trade_date DESC);
"""


@dataclass(frozen=True)
class InstrumentRow:
    id: int
    symbol: str
    family: str | None
    category: str
    currency: str | None
    snapshot_interval_seconds: int
    is_active: bool

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "family": self.family,
            "category": self.category,
            "currency": self.currency,
            "snapshot_interval_seconds": self.snapshot_interval_seconds,
            "is_active": self.is_active,
        }


@dataclass(frozen=True)
class TickPayload:
    ts: datetime
    instrument_id: int
    last: float | None
    delta_volume: int
    cumulative_volume: int | None


@dataclass(frozen=True)
class DailySummaryRow:
    trade_date: date
    instrument_id: int
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    vwap: float | None
    total_amount: float | None
    total_volume_nominal: int | None
    trades_count: int

    def to_dict(self) -> dict:
        return {
            "trade_date": self.trade_date.isoformat(),
            "instrument_id": self.instrument_id,
            "open": float(self.open) if self.open is not None else None,
            "high": float(self.high) if self.high is not None else None,
            "low": float(self.low) if self.low is not None else None,
            "close": float(self.close) if self.close is not None else None,
            "vwap": float(self.vwap) if self.vwap is not None else None,
            "total_amount": float(self.total_amount) if self.total_amount is not None else None,
            "total_volume_nominal": self.total_volume_nominal,
            "trades_count": self.trades_count,
        }


class MarketHistoryStorage:
    """Postgres-backed storage para market data ticks y resumen diario.

    Compatible con Postgres comun y con TimescaleDB. Para activar TimescaleDB
    a futuro: CREATE EXTENSION timescaledb; SELECT create_hypertable('market_ticks', 'ts');
    """

    def __init__(self, dsn: str | None) -> None:
        self.dsn = dsn
        self._pool: "asyncpg.Pool | None" = None  # type: ignore[name-defined]

    @property
    def is_configured(self) -> bool:
        return bool(self.dsn) and asyncpg is not None

    async def connect(self) -> None:
        if not self.is_configured:
            return
        if self._pool is not None:
            return
        normalized = self._normalize_dsn(self.dsn)
        self._pool = await asyncpg.create_pool(
            dsn=normalized,
            min_size=1,
            max_size=4,
            command_timeout=30,
        )
        async with self._pool.acquire() as connection:
            await connection.execute(SCHEMA_SQL)
        logger.info("market_storage: pool conectado y schema asegurado")

    async def disconnect(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    @staticmethod
    def _normalize_dsn(dsn: str | None) -> str | None:
        if not dsn:
            return dsn
        if dsn.startswith("postgres://"):
            return "postgresql://" + dsn[len("postgres://"):]
        return dsn

    async def upsert_instrument(
        self,
        symbol: str,
        family: str | None,
        category: str,
        currency: str | None,
        snapshot_interval_seconds: int,
        metadata: dict | None = None,
    ) -> InstrumentRow:
        if self._pool is None:
            raise RuntimeError("market_storage no conectado")
        import json
        async with self._pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                INSERT INTO instruments (
                    symbol, family, category, currency, metadata,
                    snapshot_interval_seconds, is_active, updated_at
                )
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, TRUE, now())
                ON CONFLICT (symbol) DO UPDATE SET
                    family = EXCLUDED.family,
                    category = EXCLUDED.category,
                    currency = EXCLUDED.currency,
                    metadata = EXCLUDED.metadata,
                    snapshot_interval_seconds = EXCLUDED.snapshot_interval_seconds,
                    is_active = TRUE,
                    updated_at = now()
                RETURNING id, symbol, family, category, currency,
                          snapshot_interval_seconds, is_active
                """,
                symbol,
                family,
                category,
                currency,
                json.dumps(metadata or {}),
                snapshot_interval_seconds,
            )
        return InstrumentRow(
            id=row["id"],
            symbol=row["symbol"],
            family=row["family"],
            category=row["category"],
            currency=row["currency"],
            snapshot_interval_seconds=row["snapshot_interval_seconds"],
            is_active=row["is_active"],
        )

    async def list_instruments(self) -> list[InstrumentRow]:
        if self._pool is None:
            return []
        async with self._pool.acquire() as connection:
            rows = await connection.fetch(
                """
                SELECT id, symbol, family, category, currency,
                       snapshot_interval_seconds, is_active
                FROM instruments
                ORDER BY category, symbol
                """
            )
        return [
            InstrumentRow(
                id=r["id"],
                symbol=r["symbol"],
                family=r["family"],
                category=r["category"],
                currency=r["currency"],
                snapshot_interval_seconds=r["snapshot_interval_seconds"],
                is_active=r["is_active"],
            )
            for r in rows
        ]

    async def insert_ticks(self, ticks: Sequence[TickPayload]) -> int:
        if self._pool is None or not ticks:
            return 0
        records = [
            (
                tick.ts,
                tick.instrument_id,
                tick.last,
                tick.delta_volume,
                tick.cumulative_volume,
            )
            for tick in ticks
        ]
        async with self._pool.acquire() as connection:
            await connection.executemany(
                """
                INSERT INTO market_ticks (
                    ts, instrument_id, last, delta_volume, cumulative_volume
                )
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (ts, instrument_id) DO NOTHING
                """,
                records,
            )
        return len(records)

    async def fetch_ticks(
        self,
        instrument_id: int,
        date_from: datetime,
        date_to: datetime,
        limit: int = 5000,
    ) -> list[dict]:
        if self._pool is None:
            return []
        async with self._pool.acquire() as connection:
            rows = await connection.fetch(
                """
                SELECT ts, last, delta_volume, cumulative_volume
                FROM market_ticks
                WHERE instrument_id = $1 AND ts >= $2 AND ts <= $3
                ORDER BY ts ASC
                LIMIT $4
                """,
                instrument_id,
                date_from,
                date_to,
                limit,
            )
        return [
            {
                "ts": r["ts"].isoformat(),
                "last": float(r["last"]) if r["last"] is not None else None,
                "delta_volume": int(r["delta_volume"]),
                "cumulative_volume": int(r["cumulative_volume"]) if r["cumulative_volume"] is not None else None,
            }
            for r in rows
        ]

    async def fetch_ticks_bucketed(
        self,
        instrument_id: int,
        date_from: datetime,
        date_to: datetime,
        interval_seconds: int,
        limit: int = 5000,
    ) -> list[dict]:
        if self._pool is None:
            return []
        bucket_seconds = max(1, int(interval_seconds))
        async with self._pool.acquire() as connection:
            rows = await connection.fetch(
                f"""
                SELECT
                    to_timestamp(floor(extract(epoch FROM ts) / {bucket_seconds}) * {bucket_seconds})
                        AT TIME ZONE 'UTC' AS bucket_ts,
                    (array_agg(last ORDER BY ts ASC))[1] AS open,
                    MAX(last) AS high,
                    MIN(last) AS low,
                    (array_agg(last ORDER BY ts DESC))[1] AS close,
                    SUM(delta_volume) AS volume,
                    CASE WHEN SUM(delta_volume) > 0
                         THEN SUM(last * delta_volume) / NULLIF(SUM(delta_volume), 0)
                         ELSE NULL END AS vwap
                FROM market_ticks
                WHERE instrument_id = $1 AND ts >= $2 AND ts <= $3
                GROUP BY 1
                ORDER BY 1 ASC
                LIMIT $4
                """,
                instrument_id,
                date_from,
                date_to,
                limit,
            )
        return [
            {
                "ts": r["bucket_ts"].isoformat(),
                "open": float(r["open"]) if r["open"] is not None else None,
                "high": float(r["high"]) if r["high"] is not None else None,
                "low": float(r["low"]) if r["low"] is not None else None,
                "close": float(r["close"]) if r["close"] is not None else None,
                "volume": int(r["volume"]) if r["volume"] is not None else 0,
                "vwap": float(r["vwap"]) if r["vwap"] is not None else None,
            }
            for r in rows
        ]

    async def upsert_daily_summary(self, trade_date: date) -> int:
        """Calcula y persiste el resumen diario para todos los instrumentos
        que tuvieron ticks en ese dia. Idempotente."""
        if self._pool is None:
            return 0
        start = datetime(trade_date.year, trade_date.month, trade_date.day, tzinfo=timezone.utc)
        async with self._pool.acquire() as connection:
            result = await connection.execute(
                """
                INSERT INTO daily_summary (
                    trade_date, instrument_id, open, high, low, close, vwap,
                    total_amount, total_volume_nominal, trades_count, computed_at
                )
                SELECT
                    $1::date AS trade_date,
                    instrument_id,
                    (array_agg(last ORDER BY ts ASC) FILTER (WHERE last IS NOT NULL))[1] AS open,
                    MAX(last) AS high,
                    MIN(last) AS low,
                    (array_agg(last ORDER BY ts DESC) FILTER (WHERE last IS NOT NULL))[1] AS close,
                    CASE WHEN SUM(delta_volume) > 0
                         THEN SUM(last * delta_volume) / NULLIF(SUM(delta_volume), 0)
                         ELSE NULL END AS vwap,
                    SUM(last * delta_volume) AS total_amount,
                    SUM(delta_volume) AS total_volume_nominal,
                    COUNT(*) FILTER (WHERE delta_volume > 0) AS trades_count,
                    now() AS computed_at
                FROM market_ticks
                WHERE ts >= $2 AND ts < ($2::timestamptz + interval '1 day')
                GROUP BY instrument_id
                ON CONFLICT (trade_date, instrument_id) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    vwap = EXCLUDED.vwap,
                    total_amount = EXCLUDED.total_amount,
                    total_volume_nominal = EXCLUDED.total_volume_nominal,
                    trades_count = EXCLUDED.trades_count,
                    computed_at = EXCLUDED.computed_at
                """,
                trade_date,
                start,
            )
        try:
            count = int(result.split(" ")[-1])
        except (ValueError, IndexError):
            count = 0
        return count

    async def fetch_daily_summary(
        self,
        instrument_id: int,
        date_from: date,
        date_to: date,
    ) -> list[DailySummaryRow]:
        if self._pool is None:
            return []
        async with self._pool.acquire() as connection:
            rows = await connection.fetch(
                """
                SELECT trade_date, instrument_id, open, high, low, close,
                       vwap, total_amount, total_volume_nominal, trades_count
                FROM daily_summary
                WHERE instrument_id = $1
                  AND trade_date >= $2
                  AND trade_date <= $3
                ORDER BY trade_date ASC
                """,
                instrument_id,
                date_from,
                date_to,
            )
        return [
            DailySummaryRow(
                trade_date=r["trade_date"],
                instrument_id=r["instrument_id"],
                open=float(r["open"]) if r["open"] is not None else None,
                high=float(r["high"]) if r["high"] is not None else None,
                low=float(r["low"]) if r["low"] is not None else None,
                close=float(r["close"]) if r["close"] is not None else None,
                vwap=float(r["vwap"]) if r["vwap"] is not None else None,
                total_amount=float(r["total_amount"]) if r["total_amount"] is not None else None,
                total_volume_nominal=int(r["total_volume_nominal"]) if r["total_volume_nominal"] is not None else None,
                trades_count=int(r["trades_count"]),
            )
            for r in rows
        ]

    async def health(self) -> dict:
        if self._pool is None:
            return {"connected": False, "configured": self.is_configured}
        async with self._pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                SELECT
                    (SELECT COUNT(*) FROM instruments WHERE is_active) AS active_instruments,
                    (SELECT COUNT(*) FROM market_ticks
                     WHERE ts >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')) AS ticks_today,
                    (SELECT MAX(ts) FROM market_ticks) AS last_tick_ts,
                    (SELECT MAX(trade_date) FROM daily_summary) AS last_summary_date
                """
            )
        return {
            "connected": True,
            "configured": True,
            "active_instruments": int(row["active_instruments"]),
            "ticks_today": int(row["ticks_today"]),
            "last_tick_ts": row["last_tick_ts"].isoformat() if row["last_tick_ts"] else None,
            "last_summary_date": row["last_summary_date"].isoformat() if row["last_summary_date"] else None,
        }

    async def get_instrument_by_symbol(self, symbol: str) -> InstrumentRow | None:
        if self._pool is None:
            return None
        async with self._pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                SELECT id, symbol, family, category, currency,
                       snapshot_interval_seconds, is_active
                FROM instruments
                WHERE symbol = $1
                """,
                symbol,
            )
        if row is None:
            return None
        return InstrumentRow(
            id=row["id"],
            symbol=row["symbol"],
            family=row["family"],
            category=row["category"],
            currency=row["currency"],
            snapshot_interval_seconds=row["snapshot_interval_seconds"],
            is_active=row["is_active"],
        )
