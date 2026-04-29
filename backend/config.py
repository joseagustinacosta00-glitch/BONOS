from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv(".env.example")


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
    rofex_symbol_template: str


def get_settings() -> Settings:
    return Settings(
        market_source=os.getenv("MARKET_SOURCE", "mock").lower(),
        rofex_environment=os.getenv("ROFEX_ENVIRONMENT", "REMARKET").upper(),
        rofex_rest_url=os.getenv("ROFEX_REST_URL"),
        rofex_ws_url=os.getenv("ROFEX_WS_URL"),
        rofex_user=os.getenv("ROFEX_USER"),
        rofex_password=os.getenv("ROFEX_PASSWORD"),
        rofex_account=os.getenv("ROFEX_ACCOUNT"),
        rofex_market=os.getenv("ROFEX_MARKET", "ROFEX").upper(),
        rofex_settlement=os.getenv("ROFEX_SETTLEMENT", "24hs"),
        rofex_symbol_template=os.getenv(
            "ROFEX_SYMBOL_TEMPLATE",
            "MERV - XMEV - {symbol} - {settlement}",
        ),
    )
