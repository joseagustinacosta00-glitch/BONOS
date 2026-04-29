from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo


ARGENTINA_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


def now_argentina() -> datetime:
    return datetime.now(ARGENTINA_TZ)


def now_argentina_iso() -> str:
    return now_argentina().isoformat(timespec="seconds")
