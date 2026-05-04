from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any

from backend.bond_calculators import LECAP_TICKERS
from backend.bonds import BOND_TICKERS
from backend.market_calendar import market_calendar
from backend.market_data import MarketDataService
from backend.market_storage import InstrumentRow, MarketHistoryStorage, TickPayload
from backend.time_utils import now_argentina

logger = logging.getLogger(__name__)


CATEGORY_BOND_HD = "bond_hd"
CATEGORY_LECAP = "lecap"
CATEGORY_CAUCION = "caucion"
CATEGORY_OTHER_BOND = "bond_other"
CATEGORY_CER = "cer"
CATEGORY_TAMAR = "tamar"
CATEGORY_DUAL = "dual"


CATEGORY_INTERVAL_SECONDS: dict[str, int] = {
    CATEGORY_BOND_HD: 1,
    CATEGORY_CAUCION: 1,
    CATEGORY_OTHER_BOND: 5,
    CATEGORY_LECAP: 5,
    CATEGORY_CER: 5,
    CATEGORY_TAMAR: 5,
    CATEGORY_DUAL: 5,
}


@dataclass
class _LastState:
    last: float | None = None
    cumulative_volume: int | None = None


class MarketHistoryScheduler:
    """Task asyncio que muestrea el snapshot del MarketDataService y persiste
    ticks en Postgres durante el horario de mercado ART, ademas de calcular
    el resumen diario al cierre."""

    def __init__(
        self,
        market: MarketDataService,
        storage: MarketHistoryStorage,
        *,
        market_open: str = "10:30",
        market_close: str = "17:00",
        batch_seconds: int = 15,
        rollup_offset_minutes: int = 5,
    ) -> None:
        self.market = market
        self.storage = storage
        self.market_open = self._parse_time(market_open)
        self.market_close = self._parse_time(market_close)
        self.batch_seconds = max(1, int(batch_seconds))
        self.rollup_offset_minutes = max(1, int(rollup_offset_minutes))

        self._instrument_by_symbol: dict[str, InstrumentRow] = {}
        self._state: dict[int, _LastState] = {}
        self._pending: list[TickPayload] = []
        self._lock = asyncio.Lock()
        self._stop_event = asyncio.Event()
        self._tasks: list[asyncio.Task] = []
        self._last_rollup_date: date | None = None
        self._last_status: str = "stopped"

    @staticmethod
    def _parse_time(value: str) -> time:
        hh, mm = value.split(":")
        return time(int(hh), int(mm))

    @property
    def status(self) -> str:
        return self._last_status

    async def start(self) -> None:
        if not self.storage.is_configured:
            self._last_status = "disabled"
            logger.info("market scheduler: deshabilitado (sin DATABASE_URL)")
            return
        await self.storage.connect()
        await self._sync_instruments()
        self._stop_event.clear()
        self._tasks = [
            asyncio.create_task(self._sample_loop(), name="market-sample-loop"),
            asyncio.create_task(self._flush_loop(), name="market-flush-loop"),
            asyncio.create_task(self._rollup_loop(), name="market-rollup-loop"),
        ]
        self._last_status = "running"
        logger.info("market scheduler: arrancado con %d instrumentos", len(self._instrument_by_symbol))

    async def stop(self) -> None:
        self._stop_event.set()
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
        self._tasks = []
        await self._flush_pending()
        await self.storage.disconnect()
        self._last_status = "stopped"

    async def _sync_instruments(self) -> None:
        registered = await self.storage.list_instruments()
        for row in registered:
            self._instrument_by_symbol[row.symbol] = row

        for ticker in BOND_TICKERS:
            symbol = ticker.symbol
            family = ticker.family
            currency = ticker.currency
            row = await self.storage.upsert_instrument(
                symbol=symbol,
                family=family,
                category=CATEGORY_BOND_HD,
                currency=currency,
                snapshot_interval_seconds=CATEGORY_INTERVAL_SECONDS[CATEGORY_BOND_HD],
            )
            self._instrument_by_symbol[symbol] = row

        for ticker in LECAP_TICKERS:
            symbol = f"LECAP:{ticker}"
            row = await self.storage.upsert_instrument(
                symbol=symbol,
                family=ticker,
                category=CATEGORY_LECAP,
                currency="ARS",
                snapshot_interval_seconds=CATEGORY_INTERVAL_SECONDS[CATEGORY_LECAP],
                metadata={"lecap_ticker": ticker, "settlement_type": "t1"},
            )
            self._instrument_by_symbol[symbol] = row

        caucion_quotes = self.market.caucion_quotes()
        for quote in caucion_quotes:
            symbol = f"CAUCION:{quote.get('symbol')}"
            row = await self.storage.upsert_instrument(
                symbol=symbol,
                family=str(quote.get("symbol") or ""),
                category=CATEGORY_CAUCION,
                currency="ARS",
                snapshot_interval_seconds=CATEGORY_INTERVAL_SECONDS[CATEGORY_CAUCION],
                metadata={"term_days": quote.get("term_days")},
            )
            self._instrument_by_symbol[symbol] = row

    def _is_market_open(self, when: datetime) -> bool:
        if not market_calendar.is_business_day(when.date()):
            return False
        current = when.time()
        return self.market_open <= current <= self.market_close

    async def _sample_loop(self) -> None:
        while not self._stop_event.is_set():
            now = now_argentina()
            if not self._is_market_open(now):
                self._last_status = "outside_market_hours"
                await asyncio.sleep(30)
                continue

            self._last_status = "running"
            await self._sample_once(now)
            await asyncio.sleep(1)

    async def _sample_once(self, when: datetime) -> None:
        snapshot = self.market.snapshot()
        ts = when.astimezone()

        for quote in snapshot.get("quotes", []):
            symbol = quote.get("symbol")
            if symbol and symbol in self._instrument_by_symbol:
                self._maybe_enqueue(symbol, quote, ts)

        for ticker in LECAP_TICKERS:
            quote = self.market.lecap_quote(ticker, "t1")
            if quote:
                self._maybe_enqueue(f"LECAP:{ticker}", quote, ts)

        for caucion in self.market.caucion_quotes():
            symbol = caucion.get("symbol")
            if symbol:
                self._maybe_enqueue(f"CAUCION:{symbol}", caucion, ts)

    def _maybe_enqueue(self, symbol: str, quote: dict[str, Any], ts: datetime) -> None:
        instrument = self._instrument_by_symbol.get(symbol)
        if instrument is None:
            return
        last = quote.get("last")
        cumulative = quote.get("cumulative_volume")
        if cumulative is None:
            cumulative = quote.get("volume")

        state = self._state.setdefault(instrument.id, _LastState())
        prev_cum = state.cumulative_volume
        delta_volume = 0
        if cumulative is not None and prev_cum is not None and cumulative > prev_cum:
            delta_volume = int(cumulative - prev_cum)
        elif cumulative is not None and prev_cum is None:
            delta_volume = 0  # primer sample del dia, no contar como trade

        price_changed = state.last is not None and last is not None and last != state.last
        had_trade = delta_volume > 0
        first_sample_with_data = state.last is None and last is not None

        if not (price_changed or had_trade or first_sample_with_data):
            state.cumulative_volume = cumulative if cumulative is not None else state.cumulative_volume
            return

        self._pending.append(
            TickPayload(
                ts=ts,
                instrument_id=instrument.id,
                last=float(last) if last is not None else None,
                delta_volume=delta_volume,
                cumulative_volume=int(cumulative) if cumulative is not None else None,
            )
        )
        state.last = float(last) if last is not None else state.last
        state.cumulative_volume = int(cumulative) if cumulative is not None else state.cumulative_volume

    async def _flush_loop(self) -> None:
        while not self._stop_event.is_set():
            await asyncio.sleep(self.batch_seconds)
            await self._flush_pending()

    async def _flush_pending(self) -> None:
        if not self._pending:
            return
        async with self._lock:
            batch = list(self._pending)
            self._pending.clear()
        if not batch:
            return
        try:
            count = await self.storage.insert_ticks(batch)
            logger.debug("market scheduler: insertados %d ticks", count)
        except Exception as exc:
            logger.exception("market scheduler: fallo flush %s", exc)
            async with self._lock:
                # reinyectar para reintentar (limite simple para no crecer infinito)
                if len(self._pending) < 50_000:
                    self._pending.extend(batch)

    async def _rollup_loop(self) -> None:
        while not self._stop_event.is_set():
            await asyncio.sleep(60)
            now = now_argentina()
            if not market_calendar.is_business_day(now.date()):
                continue
            close_with_offset = (
                datetime.combine(now.date(), self.market_close).replace(tzinfo=now.tzinfo)
            )
            from datetime import timedelta
            target = close_with_offset + timedelta(minutes=self.rollup_offset_minutes)
            if now >= target and self._last_rollup_date != now.date():
                try:
                    await self.storage.upsert_daily_summary(now.date())
                    self._last_rollup_date = now.date()
                    logger.info("market scheduler: rollup diario %s OK", now.date())
                except Exception as exc:
                    logger.exception("market scheduler: rollup fallo %s", exc)

    async def force_rollup(self, target_date: date) -> int:
        return await self.storage.upsert_daily_summary(target_date)
