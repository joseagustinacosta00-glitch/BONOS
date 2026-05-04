from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Protocol


class BondModelType(StrEnum):
    LECAP = "lecap"
    CER = "cer"
    TAMAR = "tamar"
    PESOS_FIXED_RATE = "pesos_fixed_rate"
    HARD_DOLLAR = "hard_dollar"
    DUAL = "dual"


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
class LecapMarketRow:
    ticker: str
    settlement_type: str
    settlement_date: date
    maturity_date: date
    effective_payment_date: date
    final_value: float
    days_to_payment: int
    bid: float | None
    offer: float | None
    last: float | None
    tna_bid: float | None
    tna_offer: float | None
    tna_last: float | None
    tir_last: float | None
    tem_last: float | None
    duration: float | None
    modified_duration: float | None
    convexity: float | None
    updated_at: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "ticker": self.ticker,
            "settlement_type": self.settlement_type,
            "settlement_date": self.settlement_date.isoformat(),
            "maturity_date": self.maturity_date.isoformat(),
            "effective_payment_date": self.effective_payment_date.isoformat(),
            "final_value": self.final_value,
            "days_to_payment": self.days_to_payment,
            "bid": self.bid,
            "offer": self.offer,
            "last": self.last,
            "tna_bid": self.tna_bid,
            "tna_offer": self.tna_offer,
            "tna_last": self.tna_last,
            "tir_last": self.tir_last,
            "tem_last": self.tem_last,
            "duration": self.duration,
            "modified_duration": self.modified_duration,
            "convexity": self.convexity,
            "updated_at": self.updated_at,
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


def build_lecap_market_row(
    calculation: LecapCalculation,
    settlement_type: str,
    settlement_date: date,
    bid: float | None,
    offer: float | None,
    last: float | None,
    updated_at: str | None = None,
) -> LecapMarketRow:
    cashflow = calculation.cashflows[0]
    final_value = cashflow.total
    payment_date = cashflow.effective_payment_date
    days_to_payment = (payment_date - settlement_date).days

    bid_metrics = _build_lecap_metrics(
        settlement_type, settlement_date, bid, final_value, payment_date
    )
    offer_metrics = _build_lecap_metrics(
        settlement_type, settlement_date, offer, final_value, payment_date
    )
    last_metrics = _build_lecap_metrics(
        settlement_type, settlement_date, last, final_value, payment_date
    )

    return LecapMarketRow(
        ticker=calculation.ticker,
        settlement_type=settlement_type,
        settlement_date=settlement_date,
        maturity_date=calculation.maturity_date,
        effective_payment_date=payment_date,
        final_value=final_value,
        days_to_payment=days_to_payment,
        bid=bid,
        offer=offer,
        last=last,
        tna_bid=bid_metrics.tna if bid_metrics else None,
        tna_offer=offer_metrics.tna if offer_metrics else None,
        tna_last=last_metrics.tna if last_metrics else None,
        tir_last=last_metrics.tir if last_metrics else None,
        tem_last=last_metrics.tem if last_metrics else None,
        duration=last_metrics.duration if last_metrics else None,
        modified_duration=last_metrics.modified_duration if last_metrics else None,
        convexity=last_metrics.convexity if last_metrics else None,
        updated_at=updated_at,
    )


class BondHdType(StrEnum):
    BULLET = "bullet"
    AMORTIZABLE = "amortizable"
    ZERO_COUPON = "zero_coupon"


class BondHdFrequency(StrEnum):
    ANNUAL = "annual"
    SEMIANNUAL = "semiannual"
    QUARTERLY = "quarterly"
    MONTHLY = "monthly"


class BondHdConvention(StrEnum):
    THIRTY_360_EU = "30_360_eu"
    THIRTY_360_US = "30_360_us"
    ONE_EIGHTY_360_EU = "180_360_eu"
    ONE_EIGHTY_360_US = "180_360_us"
    ACT_360 = "act_360"
    ACT_365 = "act_365"
    ACT_ACT = "act_act"


HD_FREQUENCY_MONTH_STEP: dict[BondHdFrequency, int] = {
    BondHdFrequency.ANNUAL: 12,
    BondHdFrequency.SEMIANNUAL: 6,
    BondHdFrequency.QUARTERLY: 3,
    BondHdFrequency.MONTHLY: 1,
}

HD_FREQUENCY_PERIODS_PER_YEAR: dict[BondHdFrequency, int] = {
    BondHdFrequency.ANNUAL: 1,
    BondHdFrequency.SEMIANNUAL: 2,
    BondHdFrequency.QUARTERLY: 4,
    BondHdFrequency.MONTHLY: 12,
}

HD_CONVENTION_LABELS: dict[BondHdConvention, str] = {
    BondHdConvention.THIRTY_360_EU: "30/360 EU",
    BondHdConvention.THIRTY_360_US: "30/360 US",
    BondHdConvention.ONE_EIGHTY_360_EU: "180/360 EU (fijo por frecuencia)",
    BondHdConvention.ONE_EIGHTY_360_US: "180/360 US (fijo por frecuencia)",
    BondHdConvention.ACT_360: "Act/360",
    BondHdConvention.ACT_365: "Act/365",
    BondHdConvention.ACT_ACT: "Act/Act",
}


@dataclass(frozen=True)
class BondHdCouponInput:
    payment_date: date
    annual_rate_percent: float
    amortization_percent: float = 0.0


@dataclass(frozen=True)
class BondHdCashflow:
    number: int
    payment_date: date
    effective_payment_date: date
    period_start: date
    period_end: date
    period_days: int
    year_fraction: float
    annual_rate_percent: float
    period_rate_percent: float
    amortization_vn_percent: float
    residual_vn_percent: float
    interest_per_100: float
    amortization_per_100: float
    total_per_100: float
    interest_amount: float
    amortization_amount: float
    total_amount: float

    @property
    def total(self) -> float:
        return self.amortization_amount + self.interest_amount

    def to_dict(self) -> dict[str, object]:
        return {
            "number": self.number,
            "payment_date": self.payment_date.isoformat(),
            "effective_payment_date": self.effective_payment_date.isoformat(),
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "period_days": self.period_days,
            "year_fraction": self.year_fraction,
            "annual_rate_percent": self.annual_rate_percent,
            "period_rate_percent": self.period_rate_percent,
            "amortization_vn_percent": self.amortization_vn_percent,
            "residual_vn_percent": self.residual_vn_percent,
            "interest_per_100": self.interest_per_100,
            "amortization_per_100": self.amortization_per_100,
            "total_per_100": self.total_per_100,
            "interest_amount": self.interest_amount,
            "amortization_amount": self.amortization_amount,
            "total_amount": self.total_amount,
        }


@dataclass(frozen=True)
class BondHdCalculation:
    issue_date: date
    maturity_date: date
    face_value: float
    bond_type: BondHdType
    frequency: BondHdFrequency
    convention: BondHdConvention
    cashflows: tuple[BondHdCashflow, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "issue_date": self.issue_date.isoformat(),
            "maturity_date": self.maturity_date.isoformat(),
            "face_value": self.face_value,
            "bond_type": self.bond_type.value,
            "frequency": self.frequency.value,
            "convention": self.convention.value,
            "convention_label": HD_CONVENTION_LABELS[self.convention],
            "cashflows": [cashflow.to_dict() for cashflow in self.cashflows],
        }


def hd_year_fraction(
    start: date,
    end: date,
    convention: BondHdConvention,
    frequency: BondHdFrequency | None = None,
) -> float:
    if end < start:
        return 0.0
    if convention in (BondHdConvention.ONE_EIGHTY_360_EU, BondHdConvention.ONE_EIGHTY_360_US):
        if frequency is None:
            raise ValueError("La convencion 180/360 requiere frecuencia definida.")
        # Convencion estandar: 1 / N para cupones regulares.
        # Para cupones irregulares (long/short first coupon - caso GD35 con
        # diferimiento), prorratear por dias reales sobre 360 (practica de
        # mercado para "irregular first coupon").
        standard_days = int(round(360 / HD_FREQUENCY_PERIODS_PER_YEAR[frequency]))
        actual_days = (end - start).days
        if abs(actual_days - standard_days) > 15:
            return actual_days / 360.0
        return 1.0 / HD_FREQUENCY_PERIODS_PER_YEAR[frequency]
    if convention == BondHdConvention.ACT_360:
        return (end - start).days / 360
    if convention == BondHdConvention.ACT_365:
        return (end - start).days / 365
    if convention == BondHdConvention.ACT_ACT:
        return (end - start).days / 365.25
    if convention == BondHdConvention.THIRTY_360_EU:
        d1 = min(start.day, 30)
        d2 = min(end.day, 30)
        days = (end.year - start.year) * 360 + (end.month - start.month) * 30 + (d2 - d1)
        return days / 360
    if convention == BondHdConvention.THIRTY_360_US:
        d1, d2 = start.day, end.day
        if d1 == 31:
            d1 = 30
        if d2 == 31 and d1 >= 30:
            d2 = 30
        days = (end.year - start.year) * 360 + (end.month - start.month) * 30 + (d2 - d1)
        return days / 360
    raise ValueError("Convencion de intereses no soportada.")


def hd_period_days(
    start: date,
    end: date,
    convention: BondHdConvention,
    frequency: BondHdFrequency | None = None,
) -> int:
    if convention in (BondHdConvention.ONE_EIGHTY_360_EU, BondHdConvention.ONE_EIGHTY_360_US):
        if frequency is None:
            raise ValueError("La convencion 180/360 requiere frecuencia definida.")
        standard_days = int(round(360 / HD_FREQUENCY_PERIODS_PER_YEAR[frequency]))
        actual_days = (end - start).days
        if abs(actual_days - standard_days) > 15:
            return actual_days  # Reportar dias reales del cupon irregular
        return standard_days
    if convention in (BondHdConvention.THIRTY_360_EU, BondHdConvention.THIRTY_360_US):
        if convention == BondHdConvention.THIRTY_360_EU:
            d1 = min(start.day, 30)
            d2 = min(end.day, 30)
        else:
            d1, d2 = start.day, end.day
            if d1 == 31:
                d1 = 30
            if d2 == 31 and d1 >= 30:
                d2 = 30
        return (end.year - start.year) * 360 + (end.month - start.month) * 30 + (d2 - d1)
    return (end - start).days


def generate_bond_hd_default_dates(
    issue_date: date,
    maturity_date: date,
    frequency: BondHdFrequency,
) -> list[date]:
    if maturity_date <= issue_date:
        return []
    step = HD_FREQUENCY_MONTH_STEP[frequency]
    from calendar import monthrange

    dates: list[date] = []
    cursor_year, cursor_month, cursor_day = issue_date.year, issue_date.month, issue_date.day
    safety = 0
    while True:
        safety += 1
        if safety > 2400:
            raise ValueError("Demasiados cupones generados.")
        cursor_month += step
        while cursor_month > 12:
            cursor_month -= 12
            cursor_year += 1
        last_day = monthrange(cursor_year, cursor_month)[1]
        day = min(cursor_day, last_day)
        candidate = date(cursor_year, cursor_month, day)
        if candidate >= maturity_date:
            dates.append(maturity_date)
            return dates
        dates.append(candidate)


def build_bond_hd_calculation(
    issue_date: date,
    maturity_date: date,
    face_value: float,
    bond_type: BondHdType,
    frequency: BondHdFrequency,
    convention: BondHdConvention,
    coupons: list[BondHdCouponInput],
    calendar: BusinessCalendar,
) -> BondHdCalculation:
    if maturity_date <= issue_date:
        raise ValueError("La fecha de vencimiento debe ser posterior a la fecha de emision.")
    if face_value <= 0:
        raise ValueError("El VNO debe ser mayor a cero.")
    if not coupons:
        raise ValueError("Se requiere al menos un cupon.")

    sorted_coupons = sorted(coupons, key=lambda item: item.payment_date)
    if sorted_coupons[0].payment_date <= issue_date:
        raise ValueError("Las fechas de pago deben ser posteriores a la emision.")
    if sorted_coupons[-1].payment_date != maturity_date:
        raise ValueError("La ultima fecha de pago debe coincidir con el vencimiento.")

    if bond_type == BondHdType.ZERO_COUPON:
        if len(sorted_coupons) != 1:
            raise ValueError("Zero-coupon admite un unico pago al vencimiento.")
        sorted_coupons = [
            BondHdCouponInput(
                payment_date=sorted_coupons[0].payment_date,
                annual_rate_percent=0.0,
                amortization_percent=100.0,
            )
        ]
    elif bond_type == BondHdType.BULLET:
        sorted_coupons = [
            BondHdCouponInput(
                payment_date=item.payment_date,
                annual_rate_percent=item.annual_rate_percent,
                amortization_percent=(100.0 if index == len(sorted_coupons) - 1 else 0.0),
            )
            for index, item in enumerate(sorted_coupons)
        ]
    else:
        total_amort = sum(item.amortization_percent for item in sorted_coupons)
        if abs(total_amort - 100.0) > 0.01:
            raise ValueError(
                f"Las amortizaciones deben sumar 100% (suma actual: {total_amort:.4f}%)."
            )

    cashflows: list[BondHdCashflow] = []
    period_start_eff = calendar.next_business_day(issue_date, include_current=True)
    residual_vn_percent = 100.0

    for index, coupon in enumerate(sorted_coupons, start=1):
        payment_date = coupon.payment_date
        effective_payment_date = calendar.next_business_day(payment_date, include_current=True)
        period_end_eff = effective_payment_date
        period_days = hd_period_days(period_start_eff, period_end_eff, convention, frequency)
        yf = hd_year_fraction(period_start_eff, period_end_eff, convention, frequency)

        if bond_type == BondHdType.ZERO_COUPON:
            annual_rate = 0.0
            period_rate = 0.0
            interest_per_100 = 0.0
            amort_per_100 = 100.0
        else:
            annual_rate = coupon.annual_rate_percent
            period_rate = annual_rate * yf
            interest_per_100 = period_rate * residual_vn_percent / 100.0
            amort_per_100 = coupon.amortization_percent

        residual_after = residual_vn_percent - amort_per_100
        if residual_after < -0.01:
            raise ValueError("La amortizacion del periodo supera el VN remanente.")

        cashflows.append(
            BondHdCashflow(
                number=index,
                payment_date=payment_date,
                effective_payment_date=effective_payment_date,
                period_start=period_start_eff,
                period_end=period_end_eff,
                period_days=period_days,
                year_fraction=yf,
                annual_rate_percent=annual_rate,
                period_rate_percent=period_rate,
                amortization_vn_percent=amort_per_100,
                residual_vn_percent=residual_vn_percent,
                interest_per_100=interest_per_100,
                amortization_per_100=amort_per_100,
                total_per_100=interest_per_100 + amort_per_100,
                interest_amount=interest_per_100 * face_value / 100.0,
                amortization_amount=amort_per_100 * face_value / 100.0,
                total_amount=(interest_per_100 + amort_per_100) * face_value / 100.0,
            )
        )

        residual_vn_percent = max(residual_after, 0.0)
        period_start_eff = period_end_eff

    return BondHdCalculation(
        issue_date=issue_date,
        maturity_date=maturity_date,
        face_value=face_value,
        bond_type=bond_type,
        frequency=frequency,
        convention=convention,
        cashflows=tuple(cashflows),
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
    tna = (ratio - 1) / days_to_payment * 365
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
