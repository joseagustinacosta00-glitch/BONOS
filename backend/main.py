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
from backend.bond_calculators import (
    LECAP_TICKERS,
    BondModelType,
    build_bond_draft,
    build_lecap_calculation,
    build_lecap_market_row,
)
from backend.bonds import BOND_TICKERS
from backend.config import get_settings
from backend.hard_dollar import calculate_hard_dollar_ytm, hard_dollar_bond
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


class TPlusConversionRequest(BaseModel):
    direction: str = Field(pattern="^(t0_to_t1|t1_to_t0)$")
    price: float = Field(gt=0)
    rate_percent: float | None = None
    use_auto_rate: bool = True


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


@app.get("/api/bonds/{family}/cashflows")
async def bond_cashflows(family: str, settlement_date: date | None = None) -> dict:
    bond = hard_dollar_bond(family)
    if bond is None:
        raise HTTPException(status_code=404, detail="Bono no soportado.")
    target_date = settlement_date or now_argentina().date()
    return {
        "settlement_date": target_date.isoformat(),
        "bond": bond.to_dict(target_date),
    }


@app.get("/api/bonds/{family}/ytm")
async def bond_ytm(family: str, price: Annotated[float, Query(gt=0)]) -> dict:
    settlement_date = now_argentina().date()
    ytm = calculate_hard_dollar_ytm(family, price, settlement_date)
    if ytm is None:
        raise HTTPException(status_code=422, detail="No se pudo calcular TIR para ese bono/precio.")
    return {
        "family": family.upper().strip(),
        "settlement_date": settlement_date.isoformat(),
        "price": price,
        "ytm": ytm,
    }


@app.get("/api/market/lecaps")
async def market_lecaps(settlement: str = "t1") -> dict:
    settlement_type = _normalize_lecap_settlement(settlement)
    today = now_argentina().date()
    settlement_date = (
        today
        if settlement_type == "t0"
        else market_calendar.next_business_day(today, include_current=False)
    )
    quote_by_ticker = {
        quote["symbol"]: quote for quote in market.lecap_quotes(settlement_type)
    }

    rows = []
    saved_by_ticker = {saved.ticker: saved for saved in storage.list_lecaps()}
    for ticker in LECAP_TICKERS:
        saved = saved_by_ticker.get(ticker)
        quote = quote_by_ticker.get(ticker, {})
        if saved is None:
            rows.append(
                {
                    "ticker": ticker,
                    "settlement_type": settlement_type.upper().replace("T", "T+"),
                    "settlement_date": settlement_date.isoformat(),
                    "maturity_date": None,
                    "effective_payment_date": None,
                    "final_value": None,
                    "days_to_payment": None,
                    "bid": _coerce_optional_float(quote.get("bid")),
                    "offer": _coerce_optional_float(quote.get("ask")),
                    "last": _coerce_optional_float(quote.get("last")),
                    "tna_bid": None,
                    "tna_offer": None,
                    "tna_last": None,
                    "tir_last": None,
                    "tem_last": None,
                    "duration": None,
                    "modified_duration": None,
                    "convexity": None,
                    "updated_at": quote.get("updated_at"),
                }
            )
            continue

        calculation = build_lecap_calculation(
            ticker=saved.ticker,
            issue_date=saved.issue_date,
            maturity_date=saved.maturity_date,
            face_value=saved.face_value,
            tem_emission_percent=saved.tem_emission_percent,
            calendar=market_calendar,
            today=today,
        )
        row = build_lecap_market_row(
            calculation=calculation,
            settlement_type=settlement_type.upper().replace("T", "T+"),
            settlement_date=settlement_date,
            bid=_coerce_optional_float(quote.get("bid")),
            offer=_coerce_optional_float(quote.get("ask")),
            last=_coerce_optional_float(quote.get("last")),
            updated_at=quote.get("updated_at"),
        )
        rows.append(row.to_dict())

    return {
        "status": market.status,
        "source": market.settings.market_source,
        "settlement_type": settlement_type,
        "settlement_date": settlement_date.isoformat(),
        "updated_at": now_argentina_iso(),
        "items": rows,
    }


@app.get("/api/market/caucion/shortest")
async def market_shortest_caucion() -> dict:
    quote = market.shortest_caucion_rate()
    return {
        "status": market.status,
        "source": market.settings.market_source,
        "updated_at": now_argentina_iso(),
        "quote": quote,
    }


@app.get("/api/market/cauciones")
async def market_cauciones() -> dict:
    items = market.caucion_quotes()
    return {
        "status": market.status,
        "source": market.settings.market_source,
        "updated_at": now_argentina_iso(),
        "items": items,
        "shortest": items[0] if items else {},
    }


@app.post("/api/tools/tplus-conversion")
async def tplus_conversion(payload: TPlusConversionRequest) -> dict:
    today = now_argentina().date()
    next_business_day = market_calendar.next_business_day(today, include_current=False)
    calendar_days = (next_business_day - today).days
    caucion_quote = market.shortest_caucion_rate()

    rate_percent = (
        _coerce_optional_float(caucion_quote.get("last"))
        if payload.use_auto_rate
        else payload.rate_percent
    )
    if rate_percent is None:
        raise HTTPException(status_code=422, detail="No hay tasa de caucion disponible.")

    rate_decimal = rate_percent / 100
    factor = 1 + rate_decimal * calendar_days / 365
    if factor <= 0:
        raise HTTPException(status_code=422, detail="La tasa genera un factor invalido.")

    converted_price = (
        payload.price * factor
        if payload.direction == "t0_to_t1"
        else payload.price / factor
    )

    return {
        "direction": payload.direction,
        "today": today.isoformat(),
        "next_business_day": next_business_day.isoformat(),
        "calendar_days": calendar_days,
        "rate_percent": rate_percent,
        "rate_source": "auto" if payload.use_auto_rate else "manual",
        "caucion": caucion_quote,
        "input_price": payload.price,
        "factor": factor,
        "converted_price": converted_price,
    }


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


def _normalize_lecap_settlement(value: str) -> str:
    normalized = value.lower().replace("+", "").replace(" ", "")
    return "t0" if normalized in {"t0", "0", "ci"} else "t1"


def _coerce_optional_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    return float(value)
