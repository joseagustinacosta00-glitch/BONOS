from __future__ import annotations

import asyncio
import logging
import math
import random
import re
import threading
from datetime import date
from typing import Any

from backend.bond_calculators import LECAP_TICKERS
from backend.bonds import BOND_TICKERS, TICKER_BY_SYMBOL, TICKER_SYMBOLS
from backend.config import Settings
from backend.hard_dollar import calculate_hard_dollar_ytm
from backend.time_utils import now_argentina
from backend.time_utils import now_argentina_iso

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.status = "stopped"
        self.last_error: str | None = None
        self._quotes: dict[str, dict[str, Any]] = {}
        self._lecap_quotes: dict[str, dict[str, dict[str, Any]]] = {}
        self._caucion_quotes: dict[str, dict[str, Any]] = {}
        self._futures_quotes: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._mock_task: asyncio.Task[None] | None = None
        self._watchdog_task: asyncio.Task[None] | None = None
        self._pyrofex: Any | None = None
        self._rofex_to_quote: dict[str, tuple[str, str, str | None]] = {}
        self._futures_provider_to_symbol: dict[str, str] = {}
        self._spot_provider_to_symbol: dict[str, str] = {}
        self._spot_quotes_dict: dict[str, dict[str, Any]] = {}
        self._last_tick_ts: float | None = None
        self._build_provider_symbol_map()

    async def start(self) -> None:
        self._seed_quotes()
        if self.settings.market_source == "pyrofex":
            try:
                await asyncio.to_thread(self._start_pyrofex)
            except Exception as exc:
                self.status = "error"
                self.last_error = str(exc)
                logger.exception("Could not start pyRofex market data: %s", exc)
            # Arrancar watchdog que reconecta el WS si los precios estan stale
            # en horario de mercado (10:30-17:00 ART)
            self._watchdog_task = asyncio.create_task(self._watchdog_loop())
            return

        self.status = "mock"
        self._mock_task = asyncio.create_task(self._mock_loop())

    async def stop(self) -> None:
        if self._mock_task:
            self._mock_task.cancel()
            try:
                await self._mock_task
            except asyncio.CancelledError:
                pass

        if getattr(self, "_watchdog_task", None):
            self._watchdog_task.cancel()
            try:
                await self._watchdog_task
            except asyncio.CancelledError:
                pass

        if self._pyrofex is not None:
            await asyncio.to_thread(self._disconnect_pyrofex)

        self.status = "stopped"

    async def _watchdog_loop(self) -> None:
        """Cada 60s verifica que los precios se esten actualizando.
        Si en horario de mercado (10:30-17:00 ART) pasaron mas de 5 minutos
        sin tick, reconecta el WS pyRofex.
        """
        STALE_THRESHOLD_SECONDS = 300  # 5 min sin ticks = stale
        CHECK_INTERVAL = 60
        try:
            while True:
                await asyncio.sleep(CHECK_INTERVAL)
                try:
                    if not self._is_market_hours():
                        continue
                    age = self._seconds_since_last_tick()
                    if age is None or age < STALE_THRESHOLD_SECONDS:
                        continue
                    logger.warning(
                        "watchdog: precios stale hace %.0fs en horario de mercado, reconectando pyRofex",
                        age,
                    )
                    try:
                        await asyncio.to_thread(self._reconnect_pyrofex)
                    except Exception as exc:
                        logger.exception("watchdog: reconect fallo: %s", exc)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    logger.exception("watchdog: loop error: %s", exc)
        except asyncio.CancelledError:
            return

    def _is_market_hours(self) -> bool:
        """True si estamos dentro de horario de mercado argentino (10:30-17:00 ART
        en dia habil)."""
        now = now_argentina()
        if now.weekday() >= 5:  # sab/dom
            return False
        # Usar el calendario explicito si esta disponible
        try:
            from backend.market_calendar import market_calendar
            if not market_calendar.is_business_day(now.date()):
                return False
        except Exception:
            pass
        minutes = now.hour * 60 + now.minute
        return 10 * 60 + 30 <= minutes <= 17 * 60

    def _seconds_since_last_tick(self) -> float | None:
        """Devuelve segundos desde el ultimo tick recibido (cualquier instrumento).
        None si nunca hubo tick."""
        with self._lock:
            ts = getattr(self, "_last_tick_ts", None)
        if ts is None:
            return None
        return (now_argentina().timestamp() - ts)

    def _reconnect_pyrofex(self) -> None:
        """Cierra la conexion actual y vuelve a inicializar."""
        try:
            self._disconnect_pyrofex()
        except Exception as exc:
            logger.warning("disconnect pre-reconnect fallo: %s", exc)
        self._start_pyrofex()
        with self._lock:
            self._last_tick_ts = now_argentina().timestamp()
        logger.info("watchdog: reconexion pyRofex completada")

    def rediscover_futures(self) -> dict[str, Any]:
        """Vuelve a llamar al catalogo de pyRofex y re-suscribe los nuevos
        futuros encontrados. Util cuando recien se habilitaron permisos en
        la cuenta y no queremos esperar a un redeploy.
        Devuelve resumen con cuantos futuros se descubrieron / suscribieron.
        """
        if self._pyrofex is None:
            raise RuntimeError("pyRofex no esta inicializado.")
        pyRofex = self._pyrofex
        environment = self._environment(pyRofex)
        entries = self._market_data_entries(pyRofex)
        market_rofx = getattr(pyRofex.Market, "ROFX", self._market(pyRofex))

        before_count = len(self._futures_provider_to_symbol)
        spot_before_count = len(self._spot_provider_to_symbol)
        # Re-cargar catalogos (futuros + spot)
        self._load_futures_catalog(pyRofex, environment)
        self._load_spot_catalog(pyRofex, environment)
        after_count = len(self._futures_provider_to_symbol)
        spot_after_count = len(self._spot_provider_to_symbol)
        new_symbols = list(self._futures_provider_to_symbol.keys())[before_count:]
        new_spot_symbols = list(self._spot_provider_to_symbol.keys())[spot_before_count:]

        # Re-suscribir TODOS los futuros + spot. En chunks de 8.
        all_symbols = list(self._futures_provider_to_symbol.keys())
        all_spot_symbols = list(self._spot_provider_to_symbol.keys())
        if not hasattr(self, "_subscription_failed") or self._subscription_failed is None:
            self._subscription_failed = []
        if not hasattr(self, "_subscription_succeeded") or self._subscription_succeeded is None:
            self._subscription_succeeded = []
        prev_failed = list(self._subscription_failed)
        prev_succeeded = list(self._subscription_succeeded)
        self._subscribe_symbol_chunk(pyRofex, environment, entries, all_symbols, market_rofx, 8)
        if all_spot_symbols:
            self._subscribe_symbol_chunk(pyRofex, environment, entries, all_spot_symbols, market_rofx, 8)
        new_failed = [s for s in self._subscription_failed if s not in prev_failed]
        new_succeeded = [s for s in self._subscription_succeeded if s not in prev_succeeded]

        return {
            "futures_before": before_count,
            "futures_after": after_count,
            "futures_added": len(new_symbols),
            "added_symbols": new_symbols,
            "spot_before": spot_before_count,
            "spot_after": spot_after_count,
            "spot_added": len(new_spot_symbols),
            "added_spot_symbols": new_spot_symbols,
            "subscription_succeeded_now": new_succeeded,
            "subscription_failed_now": new_failed,
        }

    def snapshot(self) -> dict[str, Any]:
        today = now_argentina().date()
        with self._lock:
            quotes = []
            for symbol in TICKER_SYMBOLS:
                quote = dict(self._quotes[symbol])
                price = quote.get("last") if quote.get("currency") != "ARS" else None
                quote["ytm"] = calculate_hard_dollar_ytm(
                    str(quote.get("family") or ""),
                    self._coerce_number(price),
                    today,
                )
                quotes.append(quote)

        return {
            "status": self.status,
            "source": self.settings.market_source,
            "last_error": self.last_error,
            "updated_at": now_argentina_iso(),
            "quotes": quotes,
        }

    def shortest_caucion_rate(self) -> dict[str, Any]:
        with self._lock:
            quotes = list(self._caucion_quotes.values())
        if not quotes:
            return {}
        return dict(
            sorted(
                quotes,
                key=lambda quote: (
                    int(quote.get("term_days") or 999),
                    str(quote.get("symbol") or ""),
                ),
            )[0]
        )

    def futures_quotes(self) -> list[dict[str, Any]]:
        with self._lock:
            quotes = [dict(q) for q in self._futures_quotes.values()]
            spot_last = None
            for q in self._spot_quotes_dict.values():
                if q.get("last") is not None:
                    spot_last = float(q["last"])
                    break
        # Enriquecer con: variacion en precio (last - prev close), TNA implicita
        today_iso = now_argentina().date()
        for q in quotes:
            last = q.get("last")
            prev = q.get("previous_close")
            try:
                if last is not None and prev is not None:
                    q["change_abs"] = float(last) - float(prev)
                else:
                    q["change_abs"] = None
            except (TypeError, ValueError):
                q["change_abs"] = None
            # TNA = (futuro/spot - 1) / dias_a_vencimiento * 365
            tna = None
            try:
                exp_str = q.get("expiration")
                if last is not None and spot_last and spot_last > 0 and exp_str:
                    exp_date = date.fromisoformat(str(exp_str))
                    days = (exp_date - today_iso).days
                    if days > 0:
                        tna = ((float(last) / spot_last) - 1) * 365.0 / days * 100.0
            except (TypeError, ValueError):
                tna = None
            q["tna_percent"] = tna
            q["spot_used"] = spot_last
        # Orden segun whitelist
        order_index = {sym: i for i, sym in enumerate(self.ALLOWED_DLR_SYMBOLS)}
        quotes.sort(key=lambda q: order_index.get(str(q.get("symbol") or ""), 9999))
        return quotes

    def caucion_quotes(self) -> list[dict[str, Any]]:
        with self._lock:
            quotes = list(self._caucion_quotes.values())
        return [
            dict(quote)
            for quote in sorted(
                quotes,
                key=lambda quote: (
                    int(quote.get("term_days") or 999),
                    str(quote.get("symbol") or ""),
                ),
            )
        ]

    def lecap_quotes(self, settlement_type: str) -> list[dict[str, Any]]:
        settlement_key = self._normalize_lecap_settlement_type(settlement_type)
        with self._lock:
            rows = [
                self._lecap_quotes[settlement_key][ticker]
                for ticker in LECAP_TICKERS
                if ticker in self._lecap_quotes.get(settlement_key, {})
            ]

        return [dict(row) for row in rows]

    def lecap_quote(self, ticker: str, settlement_type: str) -> dict[str, Any] | None:
        settlement_key = self._normalize_lecap_settlement_type(settlement_type)
        with self._lock:
            quote = self._lecap_quotes.get(settlement_key, {}).get(ticker.upper().strip())
        return dict(quote) if quote else None

    def _seed_quotes(self) -> None:
        now = now_argentina_iso()
        with self._lock:
            for ticker in BOND_TICKERS:
                self._quotes[ticker.symbol] = {
                    "symbol": ticker.symbol,
                    "provider_symbol": self._rofex_symbol(ticker.symbol),
                    "family": ticker.family,
                    "currency": ticker.currency,
                    "category": str(ticker.category),
                    "law": ticker.law,
                    "last": None,
                    "last_volume": None,
                    "cumulative_volume": None,
                    "bid": None,
                    "ask": None,
                    "change": None,
                    "volume": None,
                    "ytm": None,
                    "previous_close": None,
                    "opening_price": None,
                    "settlement": self.settings.rofex_settlement,
                    "updated_at": now,
                    "raw": {},
                }
            for settlement_key, settlement_label in self._lecap_settlements().items():
                self._lecap_quotes[settlement_key] = {}
                for ticker in LECAP_TICKERS:
                    self._lecap_quotes[settlement_key][ticker] = {
                        "symbol": ticker,
                        "provider_symbol": self._rofex_symbol(ticker, settlement_label),
                        "family": "LECAP",
                        "currency": "ARS",
                        "settlement_type": settlement_key,
                        "settlement": settlement_label,
                        "last": None,
                        "last_volume": None,
                        "cumulative_volume": None,
                        "bid": None,
                        "ask": None,
                        "change": None,
                        "volume": None,
                        "updated_at": now,
                        "raw": {},
                    }
            if not self._caucion_quotes:
                self._seed_caucion_quote("CAUCION_ARS_1D", 1, "CAUCION ARS 1D", now)
            for quote in self._caucion_quotes.values():
                quote["updated_at"] = now
                if self.settings.market_source == "mock" and quote["last"] is None:
                    quote["last"] = 35.0 + int(quote.get("term_days") or 1) * 0.05

            # Sembrar la whitelist de futuros DLR (mensuales + mayoristas) con
            # vencimiento calculado, asi aparecen tickers aunque pyRofex aun no
            # haya conectado.
            for symbol in self.ALLOWED_DLR_SYMBOLS:
                if symbol in self._futures_quotes:
                    continue
                expiration = self._dlr_expiration_date(symbol)
                self._futures_quotes[symbol] = {
                    "symbol": symbol,
                    "provider_symbol": symbol,
                    "category": "futuro",
                    "currency": "ARS",
                    "underlying": "DLR",
                    "is_mayorista": symbol.endswith("M"),
                    "expiration": expiration.isoformat() if expiration else None,
                    "last": None,
                    "last_volume": None,
                    "cumulative_volume": None,
                    "bid": None,
                    "ask": None,
                    "bid_size": None,
                    "ask_size": None,
                    "change": None,
                    "volume": None,
                    "trade_volume": None,
                    "nominal_volume": None,
                    "open_interest": None,
                    "previous_close": None,
                    "opening_price": None,
                    "updated_at": now,
                    "raw": {},
                }

    async def _mock_loop(self) -> None:
        base_prices = {
            "AO27": 78.0,
            "AL29": 71.5,
            "AL30": 69.0,
            "AL35": 63.0,
            "AE38": 67.0,
            "AL41": 62.0,
        }

        while True:
            now = now_argentina_iso()
            with self._lock:
                for ticker in BOND_TICKERS:
                    base = base_prices.get(ticker.family, 95.0)
                    if str(ticker.category) == "hard_dollar":
                        if ticker.currency == "ARS":
                            base *= 1180
                        elif ticker.currency == "Cable":
                            base *= 0.998

                    move = random.uniform(-0.35, 0.35)
                    last = max(base + move, 0.01)
                    spread = max(last * random.uniform(0.001, 0.003), 0.01)
                    current = self._quotes[ticker.symbol]
                    last_size = random.randint(1_000, 50_000) if random.random() < 0.6 else 0
                    cumulative_prev = current.get("cumulative_volume") or 0
                    cumulative_new = cumulative_prev + last_size
                    current.update(
                        {
                            "last": round(last, 2),
                            "last_volume": last_size if last_size else current.get("last_volume"),
                            "cumulative_volume": cumulative_new,
                            "bid": round(last - spread, 2),
                            "ask": round(last + spread, 2),
                            "change": round(random.uniform(-1.4, 1.4), 2),
                            "volume": cumulative_new,
                            "updated_at": now,
                            "raw": {"mock": True},
                        }
                    )
                for settlement_key, rows in self._lecap_quotes.items():
                    for index, ticker in enumerate(LECAP_TICKERS):
                        base = 108 + index * 1.15
                        if settlement_key == "t1":
                            base *= 1.0015
                        move = random.uniform(-0.08, 0.08)
                        last = max(base + move, 0.01)
                        spread = max(last * random.uniform(0.0004, 0.0012), 0.01)
                        current = rows[ticker]
                        last_size = random.randint(500, 20_000) if random.random() < 0.5 else 0
                        cumulative_prev = current.get("cumulative_volume") or 0
                        cumulative_new = cumulative_prev + last_size
                        current.update(
                            {
                                "last": round(last, 3),
                                "last_volume": last_size if last_size else current.get("last_volume"),
                                "cumulative_volume": cumulative_new,
                                "bid": round(last - spread, 3),
                                "ask": round(last + spread, 3),
                                "change": round(random.uniform(-0.25, 0.25), 3),
                                "volume": cumulative_new,
                                "updated_at": now,
                                "raw": {"mock": True},
                            }
                        )
                for quote in self._caucion_quotes.values():
                    term_days = int(quote.get("term_days") or 1)
                    last_size = random.randint(100_000, 5_000_000) if random.random() < 0.7 else 0
                    cumulative_prev = quote.get("cumulative_volume") or 0
                    cumulative_new = cumulative_prev + last_size
                    quote.update(
                        {
                            "last": round(35 + term_days * 0.05 + random.uniform(-0.25, 0.25), 2),
                            "last_volume": last_size if last_size else quote.get("last_volume"),
                            "cumulative_volume": cumulative_new,
                            "updated_at": now,
                            "raw": {"mock": True},
                        }
                    )
            await asyncio.sleep(1.5)

    def _start_pyrofex(self) -> None:
        self._validate_credentials()

        try:
            import pyRofex
        except ImportError as exc:
            self.status = "error"
            self.last_error = "pyRofex is not installed. Run: pip install -r requirements.txt"
            raise RuntimeError(self.last_error) from exc

        self._pyrofex = pyRofex
        environment = self._environment(pyRofex)
        entries = self._market_data_entries(pyRofex)

        self._configure_environment_urls(pyRofex, environment)
        pyRofex.initialize(
            user=self.settings.rofex_user,
            password=self.settings.rofex_password,
            account=self.settings.rofex_account,
            environment=environment,
        )

        self._load_caucion_instrument(pyRofex, environment)
        self._load_futures_catalog(pyRofex, environment)
        self._load_spot_catalog(pyRofex, environment)
        self._load_initial_rest_snapshot(pyRofex, entries)
        pyRofex.init_websocket_connection(
            market_data_handler=self._on_market_data,
            error_handler=self._on_error,
            exception_handler=self._on_exception,
            environment=environment,
        )
        self._subscribe_in_chunks(pyRofex, environment, entries)

        self.status = "connected"
        self.last_error = None

    def _subscribe_in_chunks(self, pyRofex: Any, environment: Any, entries: list[Any], chunk_size: int = 8) -> None:
        """Suscribe los instrumentos en chunks pequeños para que un simbolo
        invalido no rompa toda la subscripcion del resto."""
        bonds_symbols = list(self._rofex_to_quote.keys())
        futures_symbols = list(self._futures_provider_to_symbol.keys())
        spot_symbols = list(self._spot_provider_to_symbol.keys())
        market_bonds = self._market(pyRofex)
        market_rofx = getattr(pyRofex.Market, "ROFX", market_bonds)
        self._subscription_failed: list[str] = []
        self._subscription_succeeded: list[str] = []
        self._subscribe_symbol_chunk(pyRofex, environment, entries, bonds_symbols, market_bonds, chunk_size)
        if futures_symbols:
            self._subscribe_symbol_chunk(pyRofex, environment, entries, futures_symbols, market_rofx, chunk_size)
        if spot_symbols:
            self._subscribe_symbol_chunk(pyRofex, environment, entries, spot_symbols, market_rofx, chunk_size)
        logger.info(
            "subscripcion pyRofex: %d ok / %d fallaron (incluye %d spot)",
            len(self._subscription_succeeded),
            len(self._subscription_failed),
            len(spot_symbols),
        )

    def _subscribe_symbol_chunk(self, pyRofex: Any, environment: Any, entries: list[Any], symbols: list[str], market: Any, chunk_size: int) -> None:
        for i in range(0, len(symbols), chunk_size):
            chunk = symbols[i:i + chunk_size]
            try:
                pyRofex.market_data_subscription(
                    tickers=chunk,
                    entries=entries,
                    depth=1,
                    market=market,
                    environment=environment,
                )
                self._subscription_succeeded.extend(chunk)
            except Exception as exc:
                logger.warning("subscripcion fallo para chunk %s: %s", chunk, exc)
                for symbol in chunk:
                    try:
                        pyRofex.market_data_subscription(
                            tickers=[symbol],
                            entries=entries,
                            depth=1,
                            market=market,
                            environment=environment,
                        )
                        self._subscription_succeeded.append(symbol)
                    except Exception as exc_inner:
                        logger.warning("subscripcion fallo para %s: %s", symbol, exc_inner)
                        self._subscription_failed.append(symbol)

    def quotes_status(self) -> dict[str, Any]:
        """Diagnostico por instrumento: tiene cotizacion, cuando, provider symbol, etc."""
        with self._lock:
            instruments = []
            for symbol, quote in self._quotes.items():
                instruments.append({
                    "symbol": symbol,
                    "provider_symbol": quote.get("provider_symbol"),
                    "category": quote.get("category"),
                    "currency": quote.get("currency"),
                    "has_last": quote.get("last") is not None,
                    "last": quote.get("last"),
                    "bid": quote.get("bid"),
                    "ask": quote.get("ask"),
                    "updated_at": quote.get("updated_at"),
                    "subscription_failed": symbol in (getattr(self, "_subscription_failed", []) or []),
                })
            for settlement_key, rows in self._lecap_quotes.items():
                for symbol, quote in rows.items():
                    instruments.append({
                        "symbol": f"LECAP:{symbol}:{settlement_key}",
                        "provider_symbol": quote.get("provider_symbol"),
                        "category": "lecap",
                        "currency": "ARS",
                        "has_last": quote.get("last") is not None,
                        "last": quote.get("last"),
                        "bid": quote.get("bid"),
                        "ask": quote.get("ask"),
                        "updated_at": quote.get("updated_at"),
                        "subscription_failed": False,
                    })
            for symbol, quote in self._caucion_quotes.items():
                instruments.append({
                    "symbol": f"CAUCION:{symbol}",
                    "provider_symbol": quote.get("provider_symbol"),
                    "category": "caucion",
                    "currency": "ARS",
                    "has_last": quote.get("last") is not None,
                    "last": quote.get("last"),
                    "updated_at": quote.get("updated_at"),
                    "subscription_failed": False,
                })
        with_data = sum(1 for inst in instruments if inst["has_last"])
        without_data = len(instruments) - with_data
        failed_subs = [s for s in (getattr(self, "_subscription_failed", []) or [])]
        last_age = self._seconds_since_last_tick()
        return {
            "ws_status": self.status,
            "ws_last_tick_age_seconds": last_age,
            "ws_is_market_hours": self._is_market_hours(),
            "ws_stale": (last_age is not None and last_age > 300 and self._is_market_hours()),
            "total_instruments": len(instruments),
            "with_data": with_data,
            "without_data": without_data,
            "subscription_failed_count": len(failed_subs),
            "subscription_failed_symbols": failed_subs,
            "instruments": instruments,
        }

    def _disconnect_pyrofex(self) -> None:
        try:
            self._pyrofex.close_websocket_connection(environment=self._environment(self._pyrofex))
        except Exception as exc:
            logger.debug("Could not disconnect pyRofex websocket: %s", exc)

    def _load_initial_rest_snapshot(self, pyRofex: Any, entries: list[Any]) -> None:
        for provider_symbol in self._rofex_to_quote:
            try:
                response = pyRofex.get_market_data(
                    ticker=provider_symbol,
                    entries=entries,
                    depth=1,
                    market=self._market(pyRofex),
                    environment=self._environment(pyRofex),
                )
            except Exception as exc:
                logger.debug("Could not fetch REST snapshot for %s: %s", provider_symbol, exc)
                continue

            self._update_quote_from_message(response, provider_symbol_override=provider_symbol)

    def _validate_credentials(self) -> None:
        missing = [
            key
            for key, value in {
                "ROFEX_USER": self.settings.rofex_user,
                "ROFEX_PASSWORD": self.settings.rofex_password,
                "ROFEX_ACCOUNT": self.settings.rofex_account,
            }.items()
            if not value or str(value).startswith("your_")
        ]
        if missing:
            self.status = "error"
            self.last_error = f"Missing environment variables: {', '.join(missing)}"
            raise RuntimeError(self.last_error)

    def _on_market_data(self, message: dict[str, Any]) -> None:
        self.status = "connected"
        self.last_error = None
        # Trackear timestamp del ultimo tick para watchdog
        with self._lock:
            self._last_tick_ts = now_argentina().timestamp()
        self._update_quote_from_message(message)

    def _on_error(self, message: Any) -> None:
        self.status = "error"
        self.last_error = str(message)
        logger.error("pyRofex error: %s", message)

    def _on_exception(self, exception: Exception) -> None:
        self.status = "error"
        self.last_error = str(exception)
        logger.exception("pyRofex exception: %s", exception)

    def _update_quote_from_message(
        self,
        message: dict[str, Any],
        provider_symbol_override: str | None = None,
    ) -> None:
        provider_symbol = provider_symbol_override or self._provider_symbol_from_message(message)
        quote_ref = self._quote_ref(provider_symbol)
        if quote_ref is None:
            return
        category, local_symbol, settlement_type = quote_ref

        market_data = message.get("marketData") or message.get("market_data") or {}
        bid = self._entry_price(market_data.get("BI"))
        ask = self._entry_price(market_data.get("OF"))
        bid_size = self._entry_size(market_data.get("BI"))
        ask_size = self._entry_size(market_data.get("OF"))
        last = self._entry_price(market_data.get("LA"))
        last_volume = self._entry_size(market_data.get("LA"))
        # Volumen de contratos operados (TV) y nominal (NV)
        trade_volume = self._entry_value(market_data.get("TV"))
        nominal_volume = self._entry_value(market_data.get("NV"))
        effective_volume = self._entry_value(market_data.get("EV"))
        volume = trade_volume or nominal_volume or effective_volume
        previous_close = self._entry_price(market_data.get("CL"))
        opening_price = self._entry_price(market_data.get("OP"))
        # Open Interest: pyRofex usa "OI"
        open_interest = self._entry_value(market_data.get("OI"))
        now = now_argentina_iso()

        with self._lock:
            if category == "caucion":
                current = self._caucion_quotes[local_symbol]
            elif category == "lecap" and settlement_type:
                current = self._lecap_quotes[settlement_type][local_symbol]
            elif category == "future":
                current = self._futures_quotes[local_symbol]
            elif category == "spot":
                current = self._spot_quotes_dict[local_symbol]
            else:
                current = self._quotes[local_symbol]
            updates = {
                "bid": bid if bid is not None else current.get("bid"),
                "ask": ask if ask is not None else current.get("ask"),
                "bid_size": bid_size if bid_size is not None else current.get("bid_size"),
                "ask_size": ask_size if ask_size is not None else current.get("ask_size"),
                "last": last if last is not None else current.get("last"),
                "last_volume": last_volume if last_volume is not None else current.get("last_volume"),
                "cumulative_volume": volume if volume is not None else current.get("cumulative_volume"),
                "volume": volume if volume is not None else current.get("volume"),
                "trade_volume": trade_volume if trade_volume is not None else current.get("trade_volume"),
                "nominal_volume": nominal_volume if nominal_volume is not None else current.get("nominal_volume"),
                "open_interest": open_interest if open_interest is not None else current.get("open_interest"),
                "previous_close": previous_close if previous_close is not None else current.get("previous_close"),
                "opening_price": opening_price if opening_price is not None else current.get("opening_price"),
                "updated_at": now,
                "raw": self._json_safe(message),
            }
            # Calcular change_percent automaticamente si tenemos last + previous_close
            effective_last = updates["last"]
            effective_prev = updates["previous_close"]
            if effective_last is not None and effective_prev not in (None, 0):
                try:
                    updates["change"] = (float(effective_last) / float(effective_prev) - 1) * 100
                except (TypeError, ValueError, ZeroDivisionError):
                    pass
            current.update(updates)

    def _provider_symbol_from_message(self, message: dict[str, Any]) -> str | None:
        instrument = message.get("instrumentId") or message.get("instrument") or {}
        if isinstance(instrument, dict):
            symbol = instrument.get("symbol") or instrument.get("ticker")
            if symbol:
                return str(symbol)

        symbol = message.get("symbol") or message.get("ticker")
        return str(symbol) if symbol else None

    def _quote_ref(self, provider_symbol: str | None) -> tuple[str, str, str | None] | None:
        if not provider_symbol:
            return None

        if provider_symbol in self._spot_provider_to_symbol:
            return ("spot", provider_symbol, None)

        if provider_symbol in self._futures_provider_to_symbol:
            return ("future", provider_symbol, None)

        if provider_symbol in self._rofex_to_quote:
            return self._rofex_to_quote[provider_symbol]

        parts = {part.strip().upper() for part in provider_symbol.split("-")}
        settlement_by_label = {
            label.upper(): key for key, label in self._lecap_settlements().items()
        }
        for ticker in LECAP_TICKERS:
            if ticker in parts:
                for label, key in settlement_by_label.items():
                    if label in parts:
                        return ("lecap", ticker, key)
                return ("lecap", ticker, "t1")
        for symbol in TICKER_SYMBOLS:
            if symbol in parts:
                return ("bond", symbol, None)
        if provider_symbol in TICKER_BY_SYMBOL:
            return ("bond", provider_symbol, None)
        if provider_symbol in LECAP_TICKERS:
                return ("lecap", provider_symbol, "t1")
        return None

    def _rofex_symbol(self, symbol: str, settlement: str | None = None) -> str:
        return self.settings.rofex_symbol_template.format(
            symbol=symbol,
            settlement=settlement or self.settings.rofex_settlement,
        )

    def _build_provider_symbol_map(self) -> None:
        for symbol in TICKER_SYMBOLS:
            self._rofex_to_quote[self._rofex_symbol(symbol)] = ("bond", symbol, None)
        for settlement_key, settlement_label in self._lecap_settlements().items():
            for ticker in LECAP_TICKERS:
                self._rofex_to_quote[self._rofex_symbol(ticker, settlement_label)] = (
                    "lecap",
                    ticker,
                    settlement_key,
                )
        for symbol in self._configured_caucion_symbols():
            self._rofex_to_quote[symbol] = ("caucion", symbol, None)
            self._seed_caucion_quote(
                symbol=symbol,
                term_days=self._infer_caucion_term_days(symbol),
                label=symbol,
                updated_at=now_argentina_iso(),
            )

    def _lecap_settlements(self) -> dict[str, str]:
        return {
            "t0": self.settings.rofex_settlement_t0,
            "t1": self.settings.rofex_settlement_t1,
        }

    # Whitelist explicita: solo importamos estos futuros DLR (mensuales y
    # mensuales mayoristas terminados en M). Cualquier otro instrumento que
    # devuelva pyRofex se ignora.
    ALLOWED_DLR_SYMBOLS: tuple[str, ...] = (
        "DLR/MAY26", "DLR/MAY26M",
        "DLR/JUN26", "DLR/JUN26M",
        "DLR/JUL26", "DLR/JUL26M",
        "DLR/AGO26", "DLR/AGO26M",
        "DLR/SEP26", "DLR/SEP26M",
        "DLR/OCT26", "DLR/OCT26M",
        "DLR/NOV26", "DLR/NOV26M",
        "DLR/DIC26", "DLR/DIC26M",
        "DLR/ENE27", "DLR/ENE27M",
        "DLR/FEB27", "DLR/FEB27M",
        "DLR/MAR27", "DLR/MAR27M",
        "DLR/ABR27", "DLR/ABR27M",
    )
    _MONTH_CODE_MAP: dict[str, int] = {
        "ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AGO": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12,
    }

    # Candidatos de simbolo del dolar spot en pyRofex / Matba. Distintas
    # cuentas / environments lo nombran diferente. Probamos todos.
    SPOT_SYMBOL_CANDIDATES: tuple[str, ...] = (
        "DLR/SPOT",
        "DOLAR/SPOT",
        "DOLAR_SPOT",
        "USD/SPOT",
        "DLR/CI",
        "DLR/T0",
        "DLR/24HS",
        "DOL/SPOT",
        "USDARS/SPOT",
    )

    def _dlr_expiration_date(self, symbol: str) -> date | None:
        """Calcula el ultimo dia habil del mes de vencimiento del DLR.
        Ej: DLR/MAY26 / DLR/MAY26M -> ultimo dia habil de mayo 2026."""
        m = re.match(r"^DLR/([A-Z]{3})(\d{2})M?$", symbol.upper())
        if not m:
            return None
        month = self._MONTH_CODE_MAP.get(m.group(1))
        if month is None:
            return None
        year = 2000 + int(m.group(2))
        from calendar import monthrange
        last_day_calendar = monthrange(year, month)[1]
        candidate = date(year, month, last_day_calendar)
        # Retroceder hasta encontrar dia habil
        from backend.market_calendar import market_calendar
        while not market_calendar.is_business_day(candidate):
            candidate = date(year, month, candidate.day - 1)
            if candidate.day < 1:
                return None
        return candidate

    def _load_futures_catalog(self, pyRofex: Any, environment: Any) -> None:
        """Registra la whitelist de futuros DLR (mensuales y mayoristas) con
        sus vencimientos calculados como ultimo dia habil del mes. No depende
        del catalogo de pyRofex: ese se usa solo para logging/diagnostico."""
        # Intento opcional de listar el catalogo solo para loggear que hay
        try:
            response = pyRofex.get_detailed_instruments(environment=environment)
            instruments = self._instrument_rows(response)
            logger.info("get_detailed_instruments devolvio %d instrumentos (whitelist DLR aplica)", len(instruments))
        except Exception as exc:
            logger.info("get_detailed_instruments no disponible: %s", exc)

        now = now_argentina_iso()
        registered = 0
        for symbol in self.ALLOWED_DLR_SYMBOLS:
            self._futures_provider_to_symbol[symbol] = symbol
            if symbol not in self._futures_quotes:
                expiration = self._dlr_expiration_date(symbol)
                self._futures_quotes[symbol] = {
                    "symbol": symbol,
                    "provider_symbol": symbol,
                    "category": "futuro",
                    "currency": "ARS",
                    "underlying": "DLR",
                    "is_mayorista": symbol.endswith("M"),
                    "expiration": expiration.isoformat() if expiration else None,
                    "last": None,
                    "last_volume": None,
                    "cumulative_volume": None,
                    "bid": None,
                    "ask": None,
                    "bid_size": None,
                    "ask_size": None,
                    "change": None,
                    "volume": None,
                    "trade_volume": None,
                    "nominal_volume": None,
                    "open_interest": None,
                    "previous_close": None,
                    "opening_price": None,
                    "updated_at": now,
                    "raw": {},
                }
                registered += 1
        logger.info("DLR whitelist: %d futuros registrados", registered)
        if False:  # nunca entra: dejado para no perder el branch antiguo
            pass

    def _load_spot_catalog(self, pyRofex: Any, environment: Any) -> None:
        """Detecta el simbolo del dolar spot en el catalogo. Intenta tanto via
        get_detailed_instruments como matcheando candidatos conocidos."""
        instruments: list[Any] = []
        try:
            response = pyRofex.get_detailed_instruments(environment=environment)
            instruments = self._instrument_rows(response)
        except Exception:
            try:
                response = pyRofex.get_all_instruments(environment=environment)
                instruments = self._instrument_rows(response)
            except Exception as exc:
                logger.warning("No se pudo cargar catalogo para spot: %s", exc)

        # Set de simbolos candidatos en mayusculas para match case-insensitive
        candidate_set = {s.upper() for s in self.SPOT_SYMBOL_CANDIDATES}
        # Tambien aceptar simbolos que contengan "SPOT" + DLR/DOLAR/USD
        now = now_argentina_iso()
        registered: list[str] = []
        for instrument in instruments:
            symbol = self._instrument_symbol(instrument)
            if not symbol:
                continue
            sym_up = symbol.upper()
            # Match: candidato exacto, o contiene SPOT y referencia a dolar
            is_spot = sym_up in candidate_set or (
                "SPOT" in sym_up and any(k in sym_up for k in ("DLR", "DOLAR", "USD"))
            )
            if not is_spot:
                continue
            self._spot_provider_to_symbol[symbol] = symbol
            if symbol not in self._spot_quotes_dict:
                self._spot_quotes_dict[symbol] = {
                    "symbol": symbol,
                    "provider_symbol": symbol,
                    "category": "spot",
                    "currency": "ARS",
                    "underlying": "USD",
                    "last": None,
                    "bid": None,
                    "ask": None,
                    "updated_at": now,
                    "raw": {},
                }
                registered.append(symbol)
        logger.info("Dolar spot descubierto: %d simbolo(s) -> %s", len(registered), registered)

    def spot_quotes(self) -> list[dict[str, Any]]:
        """Devuelve los precios del dolar spot detectados (puede ser >=1)."""
        with self._lock:
            return [dict(q) for q in self._spot_quotes_dict.values()]

    def spot_last(self) -> dict[str, Any] | None:
        """Atajo: el primer spot disponible con `last` cargado."""
        with self._lock:
            for q in self._spot_quotes_dict.values():
                if q.get("last") is not None:
                    return dict(q)
            # Si ninguno tiene last, devolvemos el primero (puede tener bid/ask)
            for q in self._spot_quotes_dict.values():
                return dict(q)
        return None

    @staticmethod
    def _fallback_futures_symbols() -> list[str]:
        """Set comun de futuros DLR (dolar) en Matba Rofex. 12 meses corridos."""
        meses = [
            "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
            "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
        ]
        symbols: list[str] = []
        for year_short in ("26", "27"):
            for mes in meses:
                symbols.append(f"DLR/{mes}{year_short}")
        return symbols

    @staticmethod
    def _instrument_cficode(instrument: Any) -> str:
        if isinstance(instrument, dict):
            value = instrument.get("cficode") or instrument.get("CFICode") or instrument.get("cfiCode")
            if value:
                return str(value).upper()
        return ""

    @staticmethod
    def _is_future_instrument(symbol: str, cficode: str) -> bool:
        # CFI codes que empiezan con F suelen ser futuros (FF, FXXXSX, etc.)
        if cficode and cficode.startswith("F"):
            return True
        # Heuristica por simbolo: contiene "/" y termina en codigo mes/año (DLR/MAY26, ORO/JUN26, etc.)
        if "/" in symbol and len(symbol) >= 8:
            parts = symbol.split("/", 1)
            if len(parts) == 2 and parts[1] and any(ch.isdigit() for ch in parts[1]):
                return True
        return False

    @staticmethod
    def _futures_underlying(symbol: str) -> str:
        if "/" in symbol:
            return symbol.split("/", 1)[0]
        return symbol

    @staticmethod
    def _futures_expiration_str(instrument: Any) -> str | None:
        if isinstance(instrument, dict):
            value = (
                instrument.get("maturityDate")
                or instrument.get("MaturityDate")
                or instrument.get("expirationDate")
            )
            if value:
                return str(value)
        return None

    def _load_caucion_instrument(self, pyRofex: Any, environment: Any) -> None:
        try:
            response = pyRofex.get_all_instruments(environment=environment)
        except Exception as exc:
            logger.debug("Could not discover caucion instruments: %s", exc)
            return

        candidates = []
        configured_aliases = self._configured_caucion_symbols()
        configured_lookup = {
            self._normalize_symbol(alias): alias for alias in configured_aliases
        }
        for instrument in self._instrument_rows(response):
            symbol = self._instrument_symbol(instrument)
            if not symbol:
                continue
            text = self._instrument_text(instrument, symbol)
            upper_text = text.upper()
            alias = self._matching_configured_caucion_alias(
                symbol,
                text,
                configured_lookup,
            )
            if alias:
                candidates.append(
                    (
                        self._infer_caucion_term_days(alias),
                        alias,
                        symbol,
                        text,
                    )
                )
                continue
            if configured_aliases:
                continue
            if "CAUC" not in upper_text:
                continue
            if any(value in upper_text for value in ("USD", "DOLAR")):
                continue
            if not any(value in upper_text for value in ("ARS", "PESO", "$", "CAUC")):
                continue
            candidates.append((self._infer_caucion_term_days(text), symbol, symbol, text))

        if not candidates:
            return

        with self._lock:
            for term_days, symbol, provider_symbol, label in sorted(
                candidates,
                key=lambda item: (item[0], item[1], item[2]),
            ):
                self._rofex_to_quote.pop(symbol, None)
                self._rofex_to_quote[provider_symbol] = ("caucion", symbol, None)
                self._seed_caucion_quote(
                    symbol,
                    term_days,
                    label,
                    now_argentina_iso(),
                    provider_symbol=provider_symbol,
                )

    def _seed_caucion_quote(
        self,
        symbol: str,
        term_days: int,
        label: str,
        updated_at: str,
        provider_symbol: str | None = None,
    ) -> None:
        current = self._caucion_quotes.get(symbol, {})
        self._caucion_quotes[symbol] = {
            "symbol": symbol,
            "provider_symbol": provider_symbol or current.get("provider_symbol") or symbol,
            "label": label,
            "term_days": term_days,
            "currency": "ARS",
            "last": current.get("last"),
            "last_volume": current.get("last_volume"),
            "cumulative_volume": current.get("cumulative_volume"),
            "bid": current.get("bid"),
            "ask": current.get("ask"),
            "volume": current.get("volume"),
            "updated_at": updated_at,
            "raw": current.get("raw") or {},
        }

    def _configured_caucion_symbols(self) -> list[str]:
        return [
            value.strip()
            for value in self.settings.rofex_caucion_symbols.split(",")
            if value.strip()
        ]

    @classmethod
    def _instrument_rows(cls, response: Any) -> list[Any]:
        if isinstance(response, dict):
            rows = response.get("instruments") or response.get("data") or response.get("items")
            if isinstance(rows, list):
                return rows
        return response if isinstance(response, list) else []

    @classmethod
    def _instrument_symbol(cls, instrument: Any) -> str | None:
        if isinstance(instrument, str):
            return instrument
        if not isinstance(instrument, dict):
            return None

        instrument_id = instrument.get("instrumentId") or instrument.get("instrument") or {}
        if isinstance(instrument_id, dict):
            value = instrument_id.get("symbol") or instrument_id.get("ticker")
            if value:
                return str(value)
        value = instrument.get("symbol") or instrument.get("ticker")
        return str(value) if value else None

    @classmethod
    def _instrument_text(cls, instrument: Any, symbol: str) -> str:
        if not isinstance(instrument, dict):
            return symbol
        values = [symbol]
        for key in ("description", "securityDescription", "instrumentDescription", "maturityDate"):
            value = instrument.get(key)
            if value:
                values.append(str(value))
        return " ".join(values)

    @classmethod
    def _matching_configured_caucion_alias(
        cls,
        provider_symbol: str,
        text: str,
        configured_lookup: dict[str, str],
    ) -> str | None:
        normalized_provider = cls._normalize_symbol(provider_symbol)
        normalized_text = cls._normalize_symbol(text)
        for normalized_alias, alias in configured_lookup.items():
            if normalized_provider == normalized_alias:
                return alias
            if normalized_alias in normalized_provider or normalized_alias in normalized_text:
                return alias
        return None

    @staticmethod
    def _normalize_symbol(value: str) -> str:
        return re.sub(r"[^A-Z0-9]+", "", value.upper())

    @staticmethod
    def _infer_caucion_term_days(text: str) -> int:
        upper_text = text.upper()
        for pattern in (
            r"(\d+)\s*(?:D|DIA|DIAS|DÍAS)\b",
            r"\b(\d+)\s*(?:HS|H)\b",
            r"\b(\d{1,3})\b",
        ):
            match = re.search(pattern, upper_text)
            if match:
                value = int(match.group(1))
                return max(1, value // 24 if "H" in match.group(0) and value > 23 else value)
        return 999

    @staticmethod
    def _normalize_lecap_settlement_type(value: str) -> str:
        normalized = value.lower().replace("+", "").replace(" ", "")
        return "t0" if normalized in {"t0", "0", "ci"} else "t1"

    def _environment(self, pyRofex: Any) -> Any:
        if self.settings.rofex_environment == "LIVE":
            return pyRofex.Environment.LIVE
        return pyRofex.Environment.REMARKET

    def _configure_environment_urls(self, pyRofex: Any, environment: Any) -> None:
        rest_url, ws_url = self._normalized_api_urls()
        pyRofex._set_environment_parameter("url", rest_url, environment)
        pyRofex._set_environment_parameter("ws", ws_url, environment)

    def _normalized_api_urls(self) -> tuple[str, str]:
        rest_url = self._clean_url(self.settings.rofex_rest_url)
        ws_url = self._clean_url(self.settings.rofex_ws_url)

        if rest_url.startswith("wss://") and ws_url.startswith(("http://", "https://")):
            rest_url, ws_url = ws_url, rest_url
        elif rest_url.startswith("wss://"):
            ws_url = ws_url if ws_url.startswith("wss://") else rest_url
            rest_url = "https://" + rest_url.removeprefix("wss://")
        elif ws_url.startswith(("http://", "https://")):
            rest_url = rest_url if rest_url.startswith(("http://", "https://")) else ws_url
            ws_url = "wss://" + ws_url.removeprefix("https://").removeprefix("http://")

        if not rest_url.startswith(("http://", "https://")):
            raise RuntimeError("ROFEX_REST_URL must start with https://")
        if not ws_url.startswith("wss://"):
            raise RuntimeError("ROFEX_WS_URL must start with wss://")

        return self._ensure_trailing_slash(rest_url), self._ensure_trailing_slash(ws_url)

    @staticmethod
    def _ensure_trailing_slash(url: str) -> str:
        return url if url.endswith("/") else f"{url}/"

    @staticmethod
    def _clean_url(url: str | None) -> str:
        return (url or "").strip().strip('"').strip("'").strip()

    def _market(self, pyRofex: Any) -> Any:
        if self.settings.rofex_market == "ROFEX":
            return pyRofex.Market.ROFEX
        raise RuntimeError(f"Unsupported ROFEX_MARKET: {self.settings.rofex_market}")

    @staticmethod
    def _market_data_entries(pyRofex: Any) -> list[Any]:
        entries = [
            pyRofex.MarketDataEntry.BIDS,
            pyRofex.MarketDataEntry.OFFERS,
            pyRofex.MarketDataEntry.LAST,
            pyRofex.MarketDataEntry.TRADE_VOLUME,
        ]
        # Entries opcionales que pyRofex puede no exponer en todas las versiones.
        for attr in ("NOMINAL_VOLUME", "EFFECTIVE_VOLUME", "OPENING_PRICE",
                     "CLOSING_PRICE", "OPEN_INTEREST", "TRADE_EFFECTIVE_VOLUME"):
            value = getattr(pyRofex.MarketDataEntry, attr, None)
            if value is not None:
                entries.append(value)
        return entries

    @classmethod
    def _entry_price(cls, entry: Any) -> float | int | None:
        if isinstance(entry, list):
            if not entry:
                return None
            entry = entry[0]

        if isinstance(entry, dict):
            return cls._read_number(entry, "price", "value", "last")

        return cls._coerce_number(entry)

    @classmethod
    def _entry_value(cls, entry: Any) -> float | int | None:
        if isinstance(entry, list):
            if not entry:
                return None
            entry = entry[0]

        if isinstance(entry, dict):
            return cls._read_number(entry, "size", "volume", "value", "price")

        return cls._coerce_number(entry)

    @classmethod
    def _entry_size(cls, entry: Any) -> float | int | None:
        if isinstance(entry, list):
            if not entry:
                return None
            entry = entry[0]

        if isinstance(entry, dict):
            return cls._read_number(entry, "size", "volume")

        return None

    @staticmethod
    def _read_first(row: dict[str, Any], *names: str) -> Any:
        lower = {str(key).lower(): value for key, value in row.items()}
        for name in names:
            if name in row:
                return row[name]
            value = lower.get(name.lower())
            if value is not None:
                return value
        return None

    @classmethod
    def _read_number(cls, row: dict[str, Any], *names: str) -> float | int | None:
        return cls._coerce_number(cls._read_first(row, *names))

    @staticmethod
    def _coerce_number(value: Any) -> float | int | None:
        if value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            if isinstance(value, float) and not math.isfinite(value):
                return None
            return value

        text = str(value).strip()
        if not text or text == "-":
            return None
        if "," in text:
            text = text.replace(".", "").replace(",", ".")
        try:
            number = float(text)
        except ValueError:
            return None
        if not math.isfinite(number):
            return None
        return int(number) if number.is_integer() else number

    @classmethod
    def _json_safe(cls, value: Any) -> Any:
        if value is None or isinstance(value, (str, bool, int)):
            return value
        if isinstance(value, float):
            return value if math.isfinite(value) else None
        if isinstance(value, dict):
            return {str(key): cls._json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [cls._json_safe(item) for item in value]
        return str(value)
