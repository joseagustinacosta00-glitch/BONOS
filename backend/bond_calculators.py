from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Protocol


class BondModelType(StrEnum):
    CER = "cer"
    TAMAR = "tamar"
    PESOS_FIXED_RATE = "pesos_fixed_rate"
    HARD_DOLLAR = "hard_dollar"


class DayCount(StrEnum):
    ACT_365 = "act/365"
    ACT_360 = "act/360"
    THIRTY_360 = "30/360"


LECAP_TICKERS: tuple[str, ...] = (
    "S15Y6",
    "S29Y6",
    "T30J6",
    "S17L6",
    "S31L6",
    "S14G6",
    "S31G6",
    "S30S6",
    "S30O6",
)


class BusinessCalendar(Protocol):
    def next_business_day(self, value: date, include_current: bool = False) -> date:
        ...


@dataclass(frozen=True)
class Cashflow:
    payment_date: date
    amortization: float
    interest: float

    @property
    def total(self) -> float:
        return self.amortization + self.interest


@dataclass(frozen=True)
class LecapCashflow:
    number: int
    payment_date: date
    effective_payment_date: date
    applicable_days: int
    applicable_period_360: float
    amortization_vn: float
    amortization_vr: float
    applicable_rate: float
    interest: float

    @property
    def total(self) -> float:
        return self.amortization_vn + self.interest

    def to_dict(self) -> dict[str, object]:
        return {
            "number": self.number,
            "payment_date": self.payment_date.isoformat(),
            "effective_payment_date": self.effective_payment_date.isoformat(),
            "applicable_days": self.applicable_days,
            "applicable_period_360": self.applicable_period_360,
            "amortization_vn": self.amortization_vn,
            "amortization_vr": self.amortization_vr,
            "applicable_rate": self.applicable_rate,
            "interest": self.interest,
            "total_amortization": self.amortization_vn,
            "total_interest": self.interest,
            "total": self.total,
        }


@dataclass(frozen=True)
class LecapMarketMetrics:
    settlement_type: str
    settlement_date: date
    price: float
    days_to_payment: int
    tir: float
    modified_duration: float
    tna: float
    tem: float
    duration: float
    convexity: float

    def to_dict(self) -> dict[str, object]:
        return {
            "settlement_type": self.settlement_type,
            "settlement_date": self.settlement_date.isoformat(),
            "price": self.price,
            "days_to_payment": self.days_to_payment,
            "tir": self.tir,
            "modified_duration": self.modified_duration,
            "tna": self.tna,
            "tem": self.tem,
            "duration": self.duration,
            "convexity": self.convexity,
        }


@dataclass(frozen=True)
class LecapCalculation:
    ticker: str
    issue_date: date
    maturity_date: date
    face_value: float
    tem_emission: float
    cashflows: tuple[LecapCashflow, ...]
    metrics: tuple[LecapMarketMetrics, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "ticker": self.ticker,
            "issue_date": self.issue_date.isoformat(),
            "maturity_date": self.maturity_date.isoformat(),
            "face_value": self.face_value,
            "tem_emission": self.tem_emission,
            "cashflows": [cashflow.to_dict() for cashflow in self.cashflows],
            "metrics": [metric.to_dict() for metric in self.metrics],
        }


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


def build_lecap_calculation(
    ticker: str,
    issue_date: date,
    maturity_date: date,
    face_value: float,
    tem_emission_percent: float,
    calendar: BusinessCalendar,
    today: date,
    price_t0: float | None = None,
    price_t1: float | None = None,
) -> LecapCalculation:
    ticker = ticker.upper().strip()
    if ticker not in LECAP_TICKERS:
        raise ValueError("Ticker LECAP no soportado.")
    if maturity_date <= issue_date:
        raise ValueError("La fecha de vencimiento debe ser posterior a la fecha de emision.")
    if face_value <= 0:
        raise ValueError("El VNO debe ser mayor a cero.")
    if tem_emission_percent < -99:
        raise ValueError("La TEM de emision no puede ser menor a -99%.")

    tem_emission = tem_emission_percent / 100
    effective_payment_date = calendar.next_business_day(maturity_date, include_current=True)
    applicable_days = max((effective_payment_date - issue_date).days - 1, 0)
    final_value = face_value * (1 + tem_emission) ** (applicable_days / 30)
    interest = final_value - face_value

    cashflow = LecapCashflow(
        number=1,
        payment_date=maturity_date,
        effective_payment_date=effective_payment_date,
        applicable_days=applicable_days,
        applicable_period_360=applicable_days / 360,
        amortization_vn=face_value,
        amortization_vr=0,
        applicable_rate=tem_emission,
        interest=interest,
    )

    metrics = tuple(
        metric
        for metric in (
            _build_lecap_metrics("T+0", today, price_t0, cashflow.total, effective_payment_date),
            _build_lecap_metrics(
                "T+1",
                calendar.next_business_day(today, include_current=False),
                price_t1,
                cashflow.total,
                effective_payment_date,
            ),
        )
        if metric is not None
    )

    return LecapCalculation(
        ticker=ticker,
        issue_date=issue_date,
        maturity_date=maturity_date,
        face_value=face_value,
        tem_emission=tem_emission,
        cashflows=(cashflow,),
        metrics=metrics,
    )


def _build_lecap_metrics(
    settlement_type: str,
    settlement_date: date,
    price: float | None,
    final_value: float,
    payment_date: date,
) -> LecapMarketMetrics | None:
    if price is None or price <= 0:
        return None

    days_to_payment = (payment_date - settlement_date).days
    if days_to_payment <= 0:
        return None

    ratio = final_value / price
    tir = ratio ** (365 / days_to_payment) - 1
    tem = ratio ** (30 / days_to_payment) - 1
    tna = tem * 12
    duration = days_to_payment / 365
    modified_duration = duration / (1 + tir)
    convexity = duration * (duration + 1) / (1 + tir) ** 2

    return LecapMarketMetrics(
        settlement_type=settlement_type,
        settlement_date=settlement_date,
        price=price,
        days_to_payment=days_to_payment,
        tir=tir,
        modified_duration=modified_duration,
        tna=tna,
        tem=tem,
        duration=duration,
        convexity=convexity,
    )
