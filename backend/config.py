from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv(".env")
load_dotenv(".env.example", override=False)

DEFAULT_ROFEX_REST_URL = "https://api.VETA.xoms.com.ar/"
DEFAULT_ROFEX_WS_URL = "wss://api.VETA.xoms.com.ar/"
DEFAULT_CAUCION_SYMBOLS = "PESOS - 1D,PESOS - 4D"


def env_or_default(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value and value.strip() else default


@dataclass(frozen=True)
class Settings:
    market_source: str
    rofex_environment: str
    rofex_rest_url: str | None
    rofex_ws_url: str | None
    rofex_user: str | None
    rofex_password: str | None
    rofex_account: str | None
    rofex_market: str
    rofex_settlement: str
    rofex_settlement_t0: str
    rofex_settlement_t1: str
    rofex_symbol_template: str
    rofex_caucion_symbols: str
    bcra_base_url: str
    bcra_cache_ttl_seconds: int
    app_db_path: str
    market_history_database_url: str | None
    market_history_enabled: bool
    market_open_local: str
    market_close_local: str
    market_history_batch_seconds: int


def get_settings() -> Settings:
    return Settings(
        market_source=os.getenv("MARKET_SOURCE", "mock").lower(),
        rofex_environment=os.getenv("ROFEX_ENVIRONMENT", "REMARKET").upper(),
        rofex_rest_url=env_or_default("ROFEX_REST_URL", DEFAULT_ROFEX_REST_URL),
        rofex_ws_url=env_or_default("ROFEX_WS_URL", DEFAULT_ROFEX_WS_URL),
        rofex_user=os.getenv("ROFEX_USER"),
        rofex_password=os.getenv("ROFEX_PASSWORD"),
        rofex_account=os.getenv("ROFEX_ACCOUNT"),
        rofex_market=os.getenv("ROFEX_MARKET", "ROFEX").upper(),
        rofex_settlement=os.getenv("ROFEX_SETTLEMENT", "24hs"),
        rofex_settlement_t0=os.getenv("ROFEX_SETTLEMENT_T0", "CI"),
        rofex_settlement_t1=os.getenv("ROFEX_SETTLEMENT_T1", os.getenv("ROFEX_SETTLEMENT", "24hs")),
        rofex_symbol_template=os.getenv(
            "ROFEX_SYMBOL_TEMPLATE",
            "MERV - XMEV - {symbol} - {settlement}",
        ),
        rofex_caucion_symbols=os.getenv("ROFEX_CAUCION_SYMBOLS", DEFAULT_CAUCION_SYMBOLS),
        bcra_base_url=os.getenv("BCRA_BASE_URL", "https://api.bcra.gob.ar"),
        bcra_cache_ttl_seconds=int(os.getenv("BCRA_CACHE_TTL_SECONDS", "21600")),
        app_db_path=os.getenv("APP_DB_PATH", "data/user_data.db"),
        market_history_database_url=os.getenv("MARKET_HISTORY_DATABASE_URL") or os.getenv("DATABASE_URL"),
        market_history_enabled=os.getenv("MARKET_HISTORY_ENABLED", "true").lower() not in {"false", "0", "no"},
        market_open_local=os.getenv("MARKET_OPEN_LOCAL", "10:30"),
        market_close_local=os.getenv("MARKET_CLOSE_LOCAL", "17:00"),
        market_history_batch_seconds=int(os.getenv("MARKET_HISTORY_BATCH_SECONDS", "15")),
    )
