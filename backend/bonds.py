from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class BondCategory(StrEnum):
    HARD_DOLLAR = "hard_dollar"
    TASA_FIJA = "tasa_fija"
    CER = "cer"
    TAMAR = "tamar"
    DUAL = "dual"


@dataclass(frozen=True)
class BondTicker:
    symbol: str
    family: str
    currency: str
    category: BondCategory = BondCategory.HARD_DOLLAR
    law: str = "Ley local"


# Hard Dollar Ley Local: catalogo original con sus 3 variantes ARS/USD/Cable
HARD_DOLLAR_TICKERS: tuple[BondTicker, ...] = (
    BondTicker("AO27", "AO27", "ARS", BondCategory.HARD_DOLLAR),
    BondTicker("AO27D", "AO27", "USD", BondCategory.HARD_DOLLAR),
    BondTicker("AO27C", "AO27", "Cable", BondCategory.HARD_DOLLAR),
    BondTicker("AL29", "AL29", "ARS", BondCategory.HARD_DOLLAR),
    BondTicker("AL29D", "AL29", "USD", BondCategory.HARD_DOLLAR),
    BondTicker("AL29C", "AL29", "Cable", BondCategory.HARD_DOLLAR),
    BondTicker("AL30", "AL30", "ARS", BondCategory.HARD_DOLLAR),
    BondTicker("AL30D", "AL30", "USD", BondCategory.HARD_DOLLAR),
    BondTicker("AL30C", "AL30", "Cable", BondCategory.HARD_DOLLAR),
    BondTicker("AL35", "AL35", "ARS", BondCategory.HARD_DOLLAR),
    BondTicker("AL35D", "AL35", "USD", BondCategory.HARD_DOLLAR),
    BondTicker("AL35C", "AL35", "Cable", BondCategory.HARD_DOLLAR),
    BondTicker("AE38", "AE38", "ARS", BondCategory.HARD_DOLLAR),
    BondTicker("AE38D", "AE38", "USD", BondCategory.HARD_DOLLAR),
    BondTicker("AE38C", "AE38", "Cable", BondCategory.HARD_DOLLAR),
    BondTicker("AL41", "AL41", "ARS", BondCategory.HARD_DOLLAR),
    BondTicker("AL41D", "AL41", "USD", BondCategory.HARD_DOLLAR),
    BondTicker("AL41C", "AL41", "Cable", BondCategory.HARD_DOLLAR),
)

# Bonos Tasa Fija (no LECAPs - las LECAPs viven en LECAP_TICKERS aparte). Solo pesos.
TASA_FIJA_TICKERS: tuple[BondTicker, ...] = (
    BondTicker("TO26", "TO26", "ARS", BondCategory.TASA_FIJA),
    BondTicker("S30N6", "S30N6", "ARS", BondCategory.TASA_FIJA),
    BondTicker("T15E7", "T15E7", "ARS", BondCategory.TASA_FIJA),
    BondTicker("T30A7", "T30A7", "ARS", BondCategory.TASA_FIJA),
    BondTicker("T31Y7", "T31Y7", "ARS", BondCategory.TASA_FIJA),
    BondTicker("T30J7", "T30J7", "ARS", BondCategory.TASA_FIJA),
    BondTicker("TY30P", "TY30P", "ARS", BondCategory.TASA_FIJA),
)

# Bonos CER. Solo pesos por ahora (despues se pueden sumar variantes MEP/Cable).
CER_TICKERS: tuple[BondTicker, ...] = (
    BondTicker("X15Y6", "X15Y6", "ARS", BondCategory.CER),
    BondTicker("X29Y6", "X29Y6", "ARS", BondCategory.CER),
    BondTicker("TZX26", "TZX26", "ARS", BondCategory.CER),
    BondTicker("X31L6", "X31L6", "ARS", BondCategory.CER),
    BondTicker("X30S6", "X30S6", "ARS", BondCategory.CER),
    BondTicker("TZXO6", "TZXO6", "ARS", BondCategory.CER),
    BondTicker("TX26", "TX26", "ARS", BondCategory.CER),
    BondTicker("X30N6", "X30N6", "ARS", BondCategory.CER),
    BondTicker("TZXD6", "TZXD6", "ARS", BondCategory.CER),
    BondTicker("TZXM7", "TZXM7", "ARS", BondCategory.CER),
    BondTicker("TZXA7", "TZXA7", "ARS", BondCategory.CER),
    BondTicker("TZXY7", "TZXY7", "ARS", BondCategory.CER),
    BondTicker("TZX27", "TZX27", "ARS", BondCategory.CER),
    BondTicker("TZXS7", "TZXS7", "ARS", BondCategory.CER),
    BondTicker("TZXD7", "TZXD7", "ARS", BondCategory.CER),
    BondTicker("TZX28", "TZX28", "ARS", BondCategory.CER),
    BondTicker("TX28", "TX28", "ARS", BondCategory.CER),
    BondTicker("TZXS8", "TZXS8", "ARS", BondCategory.CER),
    BondTicker("TX31", "TX31", "ARS", BondCategory.CER),
    BondTicker("DICP", "DICP", "ARS", BondCategory.CER),
    BondTicker("PARP", "PARP", "ARS", BondCategory.CER),
    BondTicker("CUAP", "CUAP", "ARS", BondCategory.CER),
    BondTicker("TXMJ9", "TXMJ9", "ARS", BondCategory.CER),
)

# TAMAR puro. Solo pesos.
TAMAR_TICKERS: tuple[BondTicker, ...] = (
    BondTicker("M31G7", "M31G7", "ARS", BondCategory.TAMAR),
)

# Duales (pagan lo mejor entre fijo o TAMAR). Solo pesos.
DUAL_TICKERS: tuple[BondTicker, ...] = (
    BondTicker("TTJ26", "TTJ26", "ARS", BondCategory.DUAL),
    BondTicker("M31G6", "M31G6", "ARS", BondCategory.DUAL),
    BondTicker("TTS26", "TTS26", "ARS", BondCategory.DUAL),
    BondTicker("TTD26", "TTD26", "ARS", BondCategory.DUAL),
    BondTicker("TMF27", "TMF27", "ARS", BondCategory.DUAL),
    BondTicker("TMG27", "TMG27", "ARS", BondCategory.DUAL),
)


BOND_TICKERS: tuple[BondTicker, ...] = (
    HARD_DOLLAR_TICKERS
    + TASA_FIJA_TICKERS
    + CER_TICKERS
    + TAMAR_TICKERS
    + DUAL_TICKERS
)

TICKER_SYMBOLS: tuple[str, ...] = tuple(ticker.symbol for ticker in BOND_TICKERS)
TICKER_BY_SYMBOL: dict[str, BondTicker] = {ticker.symbol: ticker for ticker in BOND_TICKERS}


CATEGORY_LABELS: dict[BondCategory, str] = {
    BondCategory.HARD_DOLLAR: "Hard Dollar",
    BondCategory.TASA_FIJA: "Tasa Fija",
    BondCategory.CER: "CER",
    BondCategory.TAMAR: "TAMAR",
    BondCategory.DUAL: "Duales",
}
