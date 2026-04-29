from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from backend.time_utils import now_argentina


ROOT_DIR = Path(__file__).resolve().parents[1]
HOLIDAYS_PATH = ROOT_DIR / "data" / "market_holidays.csv"
BUSINESS_DAYS_PATH = ROOT_DIR / "data" / "business_days.csv"


def parse_date(value: str) -> date:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date: {value}")


def read_date_csv(path: Path) -> set[date]:
    if not path.exists():
        return set()

    with path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        return {parse_date(row["date"]) for row in reader if row.get("date")}


@dataclass(frozen=True)
class MarketCalendar:
    holidays: frozenset[date]
    explicit_business_days: frozenset[date]

    @classmethod
    def load(cls) -> "MarketCalendar":
        return cls(
            holidays=frozenset(read_date_csv(HOLIDAYS_PATH)),
            explicit_business_days=frozenset(read_date_csv(BUSINESS_DAYS_PATH)),
        )

    def is_holiday(self, value: date) -> bool:
        return value in self.holidays

    def is_business_day(self, value: date) -> bool:
        if self.explicit_business_days:
            return value in self.explicit_business_days
        return value.weekday() < 5 and value not in self.holidays

    def next_business_day(self, value: date, include_current: bool = False) -> date:
        candidate = value if include_current else value + timedelta(days=1)
        while not self.is_business_day(candidate):
            candidate += timedelta(days=1)
        return candidate

    def previous_business_day(self, value: date, include_current: bool = False) -> date:
        candidate = value if include_current else value - timedelta(days=1)
        while not self.is_business_day(candidate):
            candidate -= timedelta(days=1)
        return candidate

    def add_business_days(self, value: date, days: int) -> date:
        if days == 0:
            return self.next_business_day(value, include_current=True)

        step = 1 if days > 0 else -1
        remaining = abs(days)
        candidate = value
        while remaining:
            candidate += timedelta(days=step)
            if self.is_business_day(candidate):
                remaining -= 1
        return candidate

    def business_days_between(self, start: date, end: date, include_end: bool = True) -> list[date]:
        if end < start:
            return []

        days: list[date] = []
        candidate = start
        limit = end if include_end else end - timedelta(days=1)
        while candidate <= limit:
            if self.is_business_day(candidate):
                days.append(candidate)
            candidate += timedelta(days=1)
        return days

    def next_business_days(self, count: int, start: date | None = None) -> list[date]:
        start_date = start or now_argentina().date()
        days: list[date] = []
        candidate = start_date
        while len(days) < count:
            candidate = self.next_business_day(candidate, include_current=True)
            days.append(candidate)
            candidate += timedelta(days=1)
        return days

    def summary(self) -> dict[str, object]:
        holiday_years = sorted({item.year for item in self.holidays})
        explicit_years = sorted({item.year for item in self.explicit_business_days})
        return {
            "timezone": "America/Argentina/Buenos_Aires",
            "holiday_count": len(self.holidays),
            "holiday_years": holiday_years,
            "explicit_business_day_count": len(self.explicit_business_days),
            "explicit_business_day_years": explicit_years,
            "business_day_mode": "explicit" if self.explicit_business_days else "weekdays_minus_holidays",
        }


market_calendar = MarketCalendar.load()
