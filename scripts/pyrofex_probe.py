from __future__ import annotations

import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from backend.bonds import TICKER_SYMBOLS


load_dotenv(ROOT_DIR / ".env.example")


def env_required(name: str) -> str:
    value = os.getenv(name)
    if not value or value.startswith("your_"):
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def rofex_symbol(symbol: str) -> str:
    template = os.getenv("ROFEX_SYMBOL_TEMPLATE", "MERV - XMEV - {symbol} - {settlement}")
    settlement = os.getenv("ROFEX_SETTLEMENT", "24hs")
    return template.format(symbol=symbol, settlement=settlement)


def environment(pyRofex: Any) -> Any:
    name = os.getenv("ROFEX_ENVIRONMENT", "REMARKET").upper()
    return pyRofex.Environment.LIVE if name == "LIVE" else pyRofex.Environment.REMARKET


def configure_environment_urls(pyRofex: Any, env: Any) -> None:
    rest_url, ws_url = normalized_api_urls()
    pyRofex._set_environment_parameter("url", rest_url, env)
    pyRofex._set_environment_parameter("ws", ws_url, env)


def normalized_api_urls() -> tuple[str, str]:
    rest_url = os.getenv("ROFEX_REST_URL", "https://api.VETA.xoms.com.ar/").strip()
    ws_url = os.getenv("ROFEX_WS_URL", "wss://api.VETA.xoms.com.ar/").strip()

    if rest_url.startswith("wss://") and ws_url.startswith(("http://", "https://")):
        rest_url, ws_url = ws_url, rest_url

    if not rest_url.startswith(("http://", "https://")):
        raise RuntimeError("ROFEX_REST_URL must start with https://")
    if not ws_url.startswith("wss://"):
        raise RuntimeError("ROFEX_WS_URL must start with wss://")

    return ensure_trailing_slash(rest_url), ensure_trailing_slash(ws_url)


def ensure_trailing_slash(url: str) -> str:
    return url if url.endswith("/") else f"{url}/"


def market(pyRofex: Any) -> Any:
    name = os.getenv("ROFEX_MARKET", "ROFEX").upper()
    if name != "ROFEX":
        raise RuntimeError(f"Unsupported ROFEX_MARKET: {name}")
    return pyRofex.Market.ROFEX


def entries(pyRofex: Any) -> list[Any]:
    return [
        pyRofex.MarketDataEntry.BIDS,
        pyRofex.MarketDataEntry.OFFERS,
        pyRofex.MarketDataEntry.LAST,
        pyRofex.MarketDataEntry.TRADE_VOLUME,
    ]


def print_market_data(message: dict[str, Any]) -> None:
    instrument = message.get("instrumentId") or {}
    symbol = instrument.get("symbol") if isinstance(instrument, dict) else None
    market_data = message.get("marketData") or {}
    print(f"\n{datetime.now().strftime('%H:%M:%S')} - {symbol or 'market data'}")
    print(market_data)


def main() -> None:
    import pyRofex

    user = env_required("ROFEX_USER")
    password = env_required("ROFEX_PASSWORD")
    account = env_required("ROFEX_ACCOUNT")
    env = environment(pyRofex)
    mkt = market(pyRofex)
    requested_entries = entries(pyRofex)
    instruments = [rofex_symbol(symbol) for symbol in TICKER_SYMBOLS]

    print(f"Initializing pyRofex in {env.name}")
    configure_environment_urls(pyRofex, env)
    pyRofex.initialize(user=user, password=password, account=account, environment=env)

    print("\nREST snapshot test")
    for instrument in instruments:
        try:
            response = pyRofex.get_market_data(
                ticker=instrument,
                entries=requested_entries,
                depth=1,
                market=mkt,
                environment=env,
            )
        except Exception as exc:
            print(f"{instrument}: ERROR {exc}")
            continue
        print_market_data(response)

    def market_data_handler(message: dict[str, Any]) -> None:
        print_market_data(message)

    def error_handler(message: Any) -> None:
        print(f"WebSocket error: {message}")

    def exception_handler(exception: Exception) -> None:
        print(f"WebSocket exception: {exception}")

    print("\nOpening WebSocket subscription")
    pyRofex.init_websocket_connection(
        market_data_handler=market_data_handler,
        error_handler=error_handler,
        exception_handler=exception_handler,
        environment=env,
    )
    pyRofex.market_data_subscription(
        tickers=instruments,
        entries=requested_entries,
        depth=1,
        market=mkt,
        environment=env,
    )

    seconds = int(os.getenv("ROFEX_PROBE_SECONDS", "30"))
    try:
        print(f"Listening for {seconds} seconds...")
        time.sleep(seconds)
    finally:
        pyRofex.close_websocket_connection(environment=env)


if __name__ == "__main__":
    main()
