from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.bcra_client import BCRA_SERIES, BcraClient
from backend.bond_calculators import BondModelType, build_bond_draft
from backend.bonds import BOND_TICKERS
from backend.config import get_settings
from backend.market_calendar import market_calendar, parse_date
from backend.market_data import MarketDataService
from backend.time_utils import now_argentina_iso


ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend"

settings = get_settings()
market = MarketDataService(settings)
bcra = BcraClient(settings)

app = FastAPI(title="Monitor de Bonos", version="0.1.0")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


class BondDraftRequest(BaseModel):
    model_type: BondModelType
    issue_date: date
    maturity_date: date
    face_value: float = Field(gt=0)


@app.on_event("startup")
async def startup() -> None:
    await market.start()


@app.on_event("shutdown")
async def shutdown() -> None:
    await market.stop()


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/tickers")
async def tickers() -> list[dict[str, str]]:
    return [ticker.__dict__ for ticker in BOND_TICKERS]


@app.get("/api/quotes")
async def quotes() -> dict:
    return market.snapshot()


@app.get("/api/calendar/summary")
async def calendar_summary() -> dict:
    return market_calendar.summary()


@app.get("/api/calendar/day/{value}")
async def calendar_day(value: str) -> dict:
    target = parse_date(value)
    return {
        "date": target.isoformat(),
        "is_holiday": market_calendar.is_holiday(target),
        "is_business_day": market_calendar.is_business_day(target),
        "previous_business_day": market_calendar.previous_business_day(target).isoformat(),
        "next_business_day": market_calendar.next_business_day(target).isoformat(),
    }


@app.get("/api/calendar/business-days")
async def calendar_business_days(start: str, end: str) -> dict:
    days = market_calendar.business_days_between(parse_date(start), parse_date(end))
    return {"count": len(days), "dates": [item.isoformat() for item in days]}


@app.get("/api/bcra/series")
async def bcra_series(
    desde: date | None = None,
    hasta: date | None = None,
    limit: Annotated[int, Query(ge=0, le=3000)] = 500,
    refresh: bool = False,
) -> dict:
    return bcra.get_all_series(desde=desde, hasta=hasta, force_refresh=refresh, limit=limit)


@app.get("/api/bcra/series/{key}")
async def bcra_one_series(
    key: str,
    desde: date | None = None,
    hasta: date | None = None,
    limit: Annotated[int, Query(ge=0, le=3000)] = 500,
    refresh: bool = False,
) -> dict:
    return bcra._apply_limit(
        bcra.get_series(key, desde=desde, hasta=hasta, force_refresh=refresh),
        limit,
    )


@app.get("/api/bcra/catalog")
async def bcra_catalog() -> dict:
    return {"series": [definition.__dict__ for definition in BCRA_SERIES.values()]}


@app.post("/api/calculators/bond-draft")
async def calculator_bond_draft(payload: BondDraftRequest) -> dict:
    draft = build_bond_draft(
        model_type=payload.model_type,
        issue_date=payload.issue_date,
        maturity_date=payload.maturity_date,
        face_value=payload.face_value,
    )
    return {
        "draft": draft.to_dict(),
        "cashflow_inputs": {
            "issue_date": draft.issue_date.isoformat(),
            "maturity_date": draft.maturity_date.isoformat(),
            "face_value": draft.face_value,
        },
        "next_questions": [],
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "market": market.status,
        "timezone": "America/Argentina/Buenos_Aires",
        "now": now_argentina_iso(),
    }


@app.websocket("/ws/quotes")
async def websocket_quotes(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(market.snapshot())
            await asyncio.sleep(1)
    except (WebSocketDisconnect, RuntimeError):
        return
