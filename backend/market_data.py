from __future__ import annotations

import asyncio
import logging
import math
import random
import threading
from datetime import datetime
from typing import Any

from backend.bonds import BOND_TICKERS, TICKER_BY_SYMBOL, TICKER_SYMBOLS
from backend.config import Settings

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.status = "stopped"
        self.last_error: str | None = None
        self._quotes: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._mock_task: asyncio.Task[None] | None = None
        self._pyrofex: Any | None = None
        self._rofex_to_local: dict[str, str] = {
            self._rofex_symbol(symbol): symbol for symbol in TICKER_SYMBOLS
        }

    async def start(self) -> None:
        self._seed_quotes()
        if self.settings.market_source == "pyrofex":
            await asyncio.to_thread(self._start_pyrofex)
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

        if self._pyrofex is not None:
            await asyncio.to_thread(self._disconnect_pyrofex)

        self.status = "stopped"

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            quotes = [self._quotes[symbol] for symbol in TICKER_SYMBOLS]

        return {
            "status": self.status,
            "source": self.settings.market_source,
            "last_error": self.last_error,
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "quotes": quotes,
        }

    def _seed_quotes(self) -> None:
        now = datetime.now().isoformat(timespec="seconds")
        with self._lock:
            for ticker in BOND_TICKERS:
                self._quotes[ticker.symbol] = {
                    "symbol": ticker.symbol,
                    "provider_symbol": self._rofex_symbol(ticker.symbol),
                    "family": ticker.family,
                    "currency": ticker.currency,
                    "law": ticker.law,
                    "last": None,
                    "bid": None,
                    "ask": None,
                    "change": None,
                    "volume": None,
                    "ytm": None,
                    "settlement": self.settings.rofex_settlement,
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
            now = datetime.now().isoformat(timespec="seconds")
            with self._lock:
                for ticker in BOND_TICKERS:
                    base = base_prices.get(ticker.family, 65.0)
                    if ticker.currency == "ARS":
                        base *= 1180
                    elif ticker.currency == "Cable":
                        base *= 0.998

                    move = random.uniform(-0.35, 0.35)
                    last = max(base + move, 0.01)
                    spread = max(last * random.uniform(0.001, 0.003), 0.01)
                    self._quotes[ticker.symbol].update(
                        {
                            "last": round(last, 2),
                            "bid": round(last - spread, 2),
                            "ask": round(last + spread, 2),
                            "change": round(random.uniform(-1.4, 1.4), 2),
                            "volume": random.randint(50_000, 2_500_000),
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

        self._load_initial_rest_snapshot(pyRofex, entries)
        pyRofex.init_websocket_connection(
            market_data_handler=self._on_market_data,
            error_handler=self._on_error,
            exception_handler=self._on_exception,
            environment=environment,
        )
        pyRofex.market_data_subscription(
            tickers=list(self._rofex_to_local.keys()),
            entries=entries,
            depth=1,
            market=self._market(pyRofex),
            environment=environment,
        )

        self.status = "connected"
        self.last_error = None

    def _disconnect_pyrofex(self) -> None:
        try:
            self._pyrofex.close_websocket_connection(environment=self._environment(self._pyrofex))
        except Exception as exc:
            logger.debug("Could not disconnect pyRofex websocket: %s", exc)

    def _load_initial_rest_snapshot(self, pyRofex: Any, entries: list[Any]) -> None:
        for provider_symbol in self._rofex_to_local:
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
        local_symbol = self._local_symbol(provider_symbol)
        if local_symbol is None:
            return

        market_data = message.get("marketData") or message.get("market_data") or {}
        bid = self._entry_price(market_data.get("BI"))
        ask = self._entry_price(market_data.get("OF"))
        last = self._entry_price(market_data.get("LA"))
        volume = self._entry_value(market_data.get("TV"))
        now = datetime.now().isoformat(timespec="seconds")

        with self._lock:
            current = self._quotes[local_symbol]
            current.update(
                {
                    "bid": bid if bid is not None else current["bid"],
                    "ask": ask if ask is not None else current["ask"],
                    "last": last if last is not None else current["last"],
                    "volume": volume if volume is not None else current["volume"],
                    "updated_at": now,
                    "raw": self._json_safe(message),
                }
            )

    def _provider_symbol_from_message(self, message: dict[str, Any]) -> str | None:
        instrument = message.get("instrumentId") or message.get("instrument") or {}
        if isinstance(instrument, dict):
            symbol = instrument.get("symbol") or instrument.get("ticker")
            if symbol:
                return str(symbol)

        symbol = message.get("symbol") or message.get("ticker")
        return str(symbol) if symbol else None

    def _local_symbol(self, provider_symbol: str | None) -> str | None:
        if not provider_symbol:
            return None

        if provider_symbol in self._rofex_to_local:
            return self._rofex_to_local[provider_symbol]

        parts = {part.strip().upper() for part in provider_symbol.split("-")}
        for symbol in TICKER_SYMBOLS:
            if symbol in parts:
                return symbol
        return provider_symbol if provider_symbol in TICKER_BY_SYMBOL else None

    def _rofex_symbol(self, symbol: str) -> str:
        return self.settings.rofex_symbol_template.format(
            symbol=symbol,
            settlement=self.settings.rofex_settlement,
        )

    def _environment(self, pyRofex: Any) -> Any:
        if self.settings.rofex_environment == "LIVE":
            return pyRofex.Environment.LIVE
        return pyRofex.Environment.REMARKET

    def _configure_environment_urls(self, pyRofex: Any, environment: Any) -> None:
        rest_url, ws_url = self._normalized_api_urls()
        pyRofex._set_environment_parameter("url", rest_url, environment)
        pyRofex._set_environment_parameter("ws", ws_url, environment)

    def _normalized_api_urls(self) -> tuple[str, str]:
        rest_url = (self.settings.rofex_rest_url or "").strip()
        ws_url = (self.settings.rofex_ws_url or "").strip()

        if rest_url.startswith("wss://") and ws_url.startswith(("http://", "https://")):
            rest_url, ws_url = ws_url, rest_url
        elif rest_url.startswith("wss://") and not ws_url:
            ws_url = rest_url
            rest_url = "https://" + rest_url.removeprefix("wss://")
        elif ws_url.startswith(("http://", "https://")) and not rest_url:
            rest_url = ws_url
            ws_url = "wss://" + ws_url.removeprefix("https://").removeprefix("http://")

        if not rest_url.startswith(("http://", "https://")):
            raise RuntimeError("ROFEX_REST_URL must start with https://")
        if not ws_url.startswith("wss://"):
            raise RuntimeError("ROFEX_WS_URL must start with wss://")

        return self._ensure_trailing_slash(rest_url), self._ensure_trailing_slash(ws_url)

    @staticmethod
    def _ensure_trailing_slash(url: str) -> str:
        return url if url.endswith("/") else f"{url}/"

    def _market(self, pyRofex: Any) -> Any:
        if self.settings.rofex_market == "ROFEX":
            return pyRofex.Market.ROFEX
        raise RuntimeError(f"Unsupported ROFEX_MARKET: {self.settings.rofex_market}")

    @staticmethod
    def _market_data_entries(pyRofex: Any) -> list[Any]:
        return [
            pyRofex.MarketDataEntry.BIDS,
            pyRofex.MarketDataEntry.OFFERS,
            pyRofex.MarketDataEntry.LAST,
            pyRofex.MarketDataEntry.TRADE_VOLUME,
        ]

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
