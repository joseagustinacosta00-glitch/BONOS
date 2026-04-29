from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum


class BondModelType(StrEnum):
    CER = "cer"
    TAMAR = "tamar"
    PESOS_FIXED_RATE = "pesos_fixed_rate"
    HARD_DOLLAR = "hard_dollar"


class DayCount(StrEnum):
    ACT_365 = "act/365"
    ACT_360 = "act/360"
    THIRTY_360 = "30/360"


@dataclass(frozen=True)
class Cashflow:
    payment_date: date
    amortization: float
    interest: float

    @property
    def total(self) -> float:
        return self.amortization + self.interest


@dataclass(frozen=True)
class BondDefinition:
    ticker: str
    model_type: BondModelType
    issue_date: date
    maturity_date: date
    day_count: DayCount
    currency: str
    coupon_rate: float | None = None
    spread_rate: float | None = None
    index_lag_business_days: int = 10


@dataclass(frozen=True)
class BondDraft:
    model_type: BondModelType
    issue_date: date
    maturity_date: date
    face_value: float

    def to_dict(self) -> dict[str, object]:
        return {
            "model_type": self.model_type.value,
            "issue_date": self.issue_date.isoformat(),
            "maturity_date": self.maturity_date.isoformat(),
            "face_value": self.face_value,
        }


@dataclass(frozen=True)
class BondValuationInput:
    settlement_date: date
    clean_price: float
    face_value: float = 100.0


@dataclass(frozen=True)
class BondValuationResult:
    ticker: str
    settlement_date: date
    dirty_price: float
    accrued_interest: float
    cashflows: tuple[Cashflow, ...]
    ytm: float | None = None


def year_fraction(start: date, end: date, convention: DayCount) -> float:
    if convention == DayCount.ACT_360:
        return (end - start).days / 360
    if convention == DayCount.ACT_365:
        return (end - start).days / 365

    start_day = min(start.day, 30)
    end_day = min(end.day, 30)
    return ((end.year - start.year) * 360 + (end.month - start.month) * 30 + end_day - start_day) / 360


def build_bond_draft(
    model_type: BondModelType,
    issue_date: date,
    maturity_date: date,
    face_value: float,
) -> BondDraft:
    if maturity_date <= issue_date:
        raise ValueError("La fecha de vencimiento debe ser posterior a la fecha de emision.")
    if face_value <= 0:
        raise ValueError("El VNO debe ser mayor a cero.")

    return BondDraft(
        model_type=model_type,
        issue_date=issue_date,
        maturity_date=maturity_date,
        face_value=face_value,
    )
