from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BondTicker:
    symbol: str
    family: str
    currency: str
    law: str = "Ley local"


BOND_TICKERS: tuple[BondTicker, ...] = (
    BondTicker("AO27", "AO27", "ARS"),
    BondTicker("AO27D", "AO27", "USD"),
    BondTicker("AO27C", "AO27", "Cable"),
    BondTicker("AL29", "AL29", "ARS"),
    BondTicker("AL29D", "AL29", "USD"),
    BondTicker("AL29C", "AL29", "Cable"),
    BondTicker("AL30", "AL30", "ARS"),
    BondTicker("AL30D", "AL30", "USD"),
    BondTicker("AL30C", "AL30", "Cable"),
    BondTicker("AL35", "AL35", "ARS"),
    BondTicker("AL35D", "AL35", "USD"),
    BondTicker("AL35C", "AL35", "Cable"),
    BondTicker("AE38", "AE38", "ARS"),
    BondTicker("AE38D", "AE38", "USD"),
    BondTicker("AE38C", "AE38", "Cable"),
    BondTicker("AL41", "AL41", "ARS"),
    BondTicker("AL41D", "AL41", "USD"),
    BondTicker("AL41C", "AL41", "Cable"),
)

TICKER_SYMBOLS: tuple[str, ...] = tuple(ticker.symbol for ticker in BOND_TICKERS)
TICKER_BY_SYMBOL: dict[str, BondTicker] = {ticker.symbol: ticker for ticker in BOND_TICKERS}
