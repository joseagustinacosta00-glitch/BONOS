from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.bcra_client import BCRA_SERIES, BcraClient
from backend.bond_calculators import LECAP_TICKERS, BondModelType, build_bond_draft, build_lecap_calculation
from backend.bonds import BOND_TICKERS
from backend.config import get_settings
from backend.market_calendar import market_calendar, parse_date
from backend.market_data import MarketDataService
from backend.storage import CalculatorStorage
from backend.time_utils import now_argentina_iso
from backend.time_utils import now_argentina


ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend"

settings = get_settings()
market = MarketDataService(settings)
bcra = BcraClient(settings)
storage = CalculatorStorage(ROOT_DIR / settings.app_db_path)

app = FastAPI(title="Monitor de Bonos", version="0.1.0")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


class BondDraftRequest(BaseModel):
    model_type: BondModelType
    issue_date: date
    maturity_date: date
    face_value: float = Field(gt=0)


class LecapCalculationRequest(BaseModel):
    ticker: str
    issue_date: date
    maturity_date: date
    face_value: float = Field(gt=0)
    tem_emission_percent: float


@app.on_event("startup")
async def startup() -> None:
    storage.initialize()
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
    try:
        draft = build_bond_draft(
            model_type=payload.model_type,
            issue_date=payload.issue_date,
            maturity_date=payload.maturity_date,
            face_value=payload.face_value,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "draft": draft.to_dict(),
        "cashflow_inputs": {
            "issue_date": draft.issue_date.isoformat(),
            "maturity_date": draft.maturity_date.isoformat(),
            "face_value": draft.face_value,
        },
        "next_questions": [],
    }


@app.get("/api/calculators/lecaps/tickers")
async def calculator_lecap_tickers() -> dict:
    return {"tickers": list(LECAP_TICKERS)}


@app.post("/api/calculators/lecaps")
async def calculator_lecaps(payload: LecapCalculationRequest) -> dict:
    try:
        calculation = build_lecap_calculation(
            ticker=payload.ticker,
            issue_date=payload.issue_date,
            maturity_date=payload.maturity_date,
            face_value=payload.face_value,
            tem_emission_percent=payload.tem_emission_percent,
            calendar=market_calendar,
            today=now_argentina().date(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return calculation.to_dict()


@app.get("/api/calculators/lecaps/saved")
async def calculator_saved_lecaps() -> dict:
    items = []
    for saved in storage.list_lecaps():
        calculation = build_lecap_calculation(
            ticker=saved.ticker,
            issue_date=saved.issue_date,
            maturity_date=saved.maturity_date,
            face_value=saved.face_value,
            tem_emission_percent=saved.tem_emission_percent,
            calendar=market_calendar,
            today=now_argentina().date(),
        )
        items.append({**saved.to_dict(), "calculation": calculation.to_dict()})
    return {"items": items}


@app.post("/api/calculators/lecaps/saved")
async def calculator_save_lecap(payload: LecapCalculationRequest) -> dict:
    try:
        calculation = build_lecap_calculation(
            ticker=payload.ticker,
            issue_date=payload.issue_date,
            maturity_date=payload.maturity_date,
            face_value=payload.face_value,
            tem_emission_percent=payload.tem_emission_percent,
            calendar=market_calendar,
            today=now_argentina().date(),
        )
        saved = storage.upsert_lecap(
            ticker=payload.ticker,
            issue_date=payload.issue_date,
            maturity_date=payload.maturity_date,
            face_value=payload.face_value,
            tem_emission_percent=payload.tem_emission_percent,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"item": saved.to_dict(), "calculation": calculation.to_dict()}


@app.delete("/api/calculators/lecaps/saved/{item_id}")
async def calculator_delete_lecap(item_id: int) -> dict:
    if not storage.delete_lecap(item_id):
        raise HTTPException(status_code=404, detail="LECAP no encontrada.")
    return {"deleted": True}


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
