from __future__ import annotations

import asyncio
import logging
import math
import random
import re
import threading
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
        self._lock = threading.RLock()
        self._mock_task: asyncio.Task[None] | None = None
        self._pyrofex: Any | None = None
        self._rofex_to_quote: dict[str, tuple[str, str, str | None]] = {}
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
                    "law": ticker.law,
                    "last": None,
                    "last_volume": None,
                    "cumulative_volume": None,
                    "bid": None,
                    "ask": None,
                    "change": None,
                    "volume": None,
                    "ytm": None,
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
                    base = base_prices.get(ticker.family, 65.0)
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
        self._load_initial_rest_snapshot(pyRofex, entries)
        pyRofex.init_websocket_connection(
            market_data_handler=self._on_market_data,
            error_handler=self._on_error,
            exception_handler=self._on_exception,
            environment=environment,
        )
        pyRofex.market_data_subscription(
            tickers=list(self._rofex_to_quote.keys()),
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
        last = self._entry_price(market_data.get("LA"))
        last_volume = self._entry_size(market_data.get("LA"))
        volume = self._entry_value(market_data.get("TV"))
        now = now_argentina_iso()

        with self._lock:
            if category == "caucion":
                current = self._caucion_quotes[local_symbol]
            elif category == "lecap" and settlement_type:
                current = self._lecap_quotes[settlement_type][local_symbol]
            else:
                current = self._quotes[local_symbol]
            current.update(
                {
                    "bid": bid if bid is not None else current["bid"],
                    "ask": ask if ask is not None else current["ask"],
                    "last": last if last is not None else current["last"],
                    "last_volume": last_volume if last_volume is not None else current.get("last_volume"),
                    "cumulative_volume": volume if volume is not None else current.get("cumulative_volume"),
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

    def _quote_ref(self, provider_symbol: str | None) -> tuple[str, str, str | None] | None:
        if not provider_symbol:
            return None

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
