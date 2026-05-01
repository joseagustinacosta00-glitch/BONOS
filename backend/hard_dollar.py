from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import isfinite


@dataclass(frozen=True)
class HardDollarCashflow:
    payment_date: date
    amortization: float
    interest: float
    residual_before_payment: float

    @property
    def total(self) -> float:
        return self.amortization + self.interest

    def to_dict(self) -> dict[str, object]:
        return {
            "payment_date": self.payment_date.isoformat(),
            "amortization": self.amortization,
            "interest": self.interest,
            "total": self.total,
            "residual_before_payment": self.residual_before_payment,
        }


@dataclass(frozen=True)
class HardDollarBond:
    family: str
    name: str
    maturity_date: date
    cashflows: tuple[HardDollarCashflow, ...]

    def future_cashflows(self, settlement_date: date) -> tuple[HardDollarCashflow, ...]:
        return tuple(cashflow for cashflow in self.cashflows if cashflow.payment_date > settlement_date)

    def to_dict(self, settlement_date: date | None = None) -> dict[str, object]:
        cashflows = self.cashflows if settlement_date is None else self.future_cashflows(settlement_date)
        return {
            "family": self.family,
            "name": self.name,
            "maturity_date": self.maturity_date.isoformat(),
            "cashflows": [cashflow.to_dict() for cashflow in cashflows],
        }


def hard_dollar_bond(family: str) -> HardDollarBond | None:
    return HARD_DOLLAR_BONDS.get(family.upper().strip())


def calculate_hard_dollar_ytm(
    family: str,
    price: float | int | None,
    settlement_date: date,
) -> float | None:
    if price is None:
        return None
    price = float(price)
    if price <= 0 or not isfinite(price):
        return None

    bond = hard_dollar_bond(family)
    if bond is None:
        return None

    cashflows = bond.future_cashflows(settlement_date)
    if not cashflows:
        return None

    def present_value(rate: float) -> float:
        return sum(
            cashflow.total / (1 + rate) ** ((cashflow.payment_date - settlement_date).days / 365)
            for cashflow in cashflows
        )

    low = -0.99
    high = 10.0
    if present_value(low) < price or present_value(high) > price:
        return None

    for _ in range(100):
        mid = (low + high) / 2
        if present_value(mid) > price:
            low = mid
        else:
            high = mid

    return (low + high) / 2


def _semiannual_schedule(
    start_year: int,
    end_year: int,
    amortizations: dict[date, float],
    annual_coupon_by_year: dict[int, float],
) -> tuple[HardDollarCashflow, ...]:
    cashflows: list[HardDollarCashflow] = []
    residual = 100.0
    for year in range(start_year, end_year + 1):
        for month in (1, 7):
            payment_date = date(year, month, 9)
            amortization = amortizations.get(payment_date, 0.0)
            annual_coupon = annual_coupon_by_year.get(year, annual_coupon_by_year[max(annual_coupon_by_year)])
            interest = residual * annual_coupon / 2
            cashflows.append(
                HardDollarCashflow(
                    payment_date=payment_date,
                    amortization=amortization,
                    interest=interest,
                    residual_before_payment=residual,
                )
            )
            residual = max(residual - amortization, 0.0)
    return tuple(cashflows)


def _monthly_ao27_schedule() -> tuple[HardDollarCashflow, ...]:
    payment_dates = (
        date(2026, 4, 30),
        date(2026, 5, 29),
        date(2026, 6, 30),
        date(2026, 7, 31),
        date(2026, 8, 31),
        date(2026, 9, 30),
        date(2026, 10, 30),
        date(2026, 11, 30),
        date(2026, 12, 30),
        date(2027, 1, 29),
        date(2027, 2, 26),
        date(2027, 3, 31),
        date(2027, 4, 30),
        date(2027, 5, 31),
        date(2027, 6, 30),
        date(2027, 7, 30),
        date(2027, 8, 31),
        date(2027, 9, 30),
        date(2027, 10, 29),
    )
    previous = date(2026, 3, 31)
    cashflows: list[HardDollarCashflow] = []
    for payment_date in payment_dates:
        days = (payment_date - previous).days
        amortization = 100.0 if payment_date == date(2027, 10, 29) else 0.0
        cashflows.append(
            HardDollarCashflow(
                payment_date=payment_date,
                amortization=amortization,
                interest=100.0 * 0.06 * days / 360,
                residual_before_payment=100.0,
            )
        )
        previous = payment_date
    return tuple(cashflows)


def _equal_amortizations(start: date, count: int, amount: float) -> dict[date, float]:
    result: dict[date, float] = {}
    year = start.year
    month = start.month
    for _ in range(count):
        result[date(year, month, 9)] = amount
        if month == 1:
            month = 7
        else:
            month = 1
            year += 1
    return result


HARD_DOLLAR_BONDS: dict[str, HardDollarBond] = {
    "AO27": HardDollarBond(
        family="AO27",
        name="Bono Tesoro Nacional 6% 29/10/2027 USD",
        maturity_date=date(2027, 10, 29),
        cashflows=_monthly_ao27_schedule(),
    ),
    "AL29": HardDollarBond(
        family="AL29",
        name="Bono Nacion Argentina USD Step Up 2029 LA",
        maturity_date=date(2029, 7, 9),
        cashflows=_semiannual_schedule(
            2025,
            2029,
            _equal_amortizations(date(2025, 1, 9), 10, 10.0),
            {2025: 0.01, 2026: 0.01, 2027: 0.01, 2028: 0.01, 2029: 0.01},
        ),
    ),
    "AL30": HardDollarBond(
        family="AL30",
        name="Bono Nacion Argentina USD Step Up 2030 LA",
        maturity_date=date(2030, 7, 9),
        cashflows=_semiannual_schedule(
            2024,
            2030,
            {date(2024, 7, 9): 4.0, **_equal_amortizations(date(2025, 1, 9), 12, 8.0)},
            {
                2024: 0.0075,
                2025: 0.0075,
                2026: 0.0075,
                2027: 0.0075,
                2028: 0.015,
                2029: 0.0175,
                2030: 0.0175,
            },
        ),
    ),
    "AL35": HardDollarBond(
        family="AL35",
        name="Bono Nacion Argentina USD Step Up 2035 LA",
        maturity_date=date(2035, 7, 9),
        cashflows=_semiannual_schedule(
            2026,
            2035,
            _equal_amortizations(date(2031, 1, 9), 10, 10.0),
            {2026: 0.04125},
        ),
    ),
    "AE38": HardDollarBond(
        family="AE38",
        name="Bono Nacion Argentina USD Step Up 2038 LA",
        maturity_date=date(2038, 1, 9),
        cashflows=_semiannual_schedule(
            2026,
            2038,
            _equal_amortizations(date(2027, 7, 9), 22, 100 / 22),
            {2026: 0.05},
        ),
    ),
    "AL41": HardDollarBond(
        family="AL41",
        name="Bono Nacion Argentina USD Step Up 2041 LA",
        maturity_date=date(2041, 7, 9),
        cashflows=_semiannual_schedule(
            2026,
            2041,
            _equal_amortizations(date(2028, 1, 9), 28, 100 / 28),
            {2026: 0.035},
        ),
    ),
}
