from __future__ import annotations

import asyncio
import csv
import io
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
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
from backend.storage import HISTORICAL_METRIC_TYPES, CalculatorStorage
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


class HistoricalDataRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    metric_type: str = Field(pattern="^(parity|dirty_price|clean_price|ytm|tem|tna|volume)$")
    value_date: date
    value: float


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
        storage.upsert_cashflows(
            calculator_type="lecap",
            ticker=payload.ticker,
            cashflows=calculation.to_dict()["cashflows"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"item": saved.to_dict(), "calculation": calculation.to_dict()}


@app.delete("/api/calculators/lecaps/saved/{item_id}")
async def calculator_delete_lecap(item_id: int) -> dict:
    if not storage.delete_lecap(item_id):
        raise HTTPException(status_code=404, detail="LECAP no encontrada.")
    return {"deleted": True}


@app.get("/api/calculators/cashflows")
async def calculator_cashflows(calculator_type: str | None = None, ticker: str | None = None) -> dict:
    return {
        "items": [
            cashflow.to_dict()
            for cashflow in storage.list_cashflows(calculator_type=calculator_type, ticker=ticker)
        ]
    }


@app.get("/api/data/tickers")
async def data_tickers() -> dict:
    tickers = sorted({ticker.symbol for ticker in BOND_TICKERS} | set(LECAP_TICKERS) | set(storage.list_tickers()))
    return {"tickers": tickers}


@app.get("/api/historical-data/types")
async def historical_data_types() -> dict:
    return {
        "types": [
            {"key": "parity", "label": "Paridad"},
            {"key": "dirty_price", "label": "Precio dirty"},
            {"key": "clean_price", "label": "Precio clean"},
            {"key": "ytm", "label": "TIR"},
            {"key": "tem", "label": "TEM"},
            {"key": "tna", "label": "TNA"},
            {"key": "volume", "label": "Volumen"},
        ],
        "supported": list(HISTORICAL_METRIC_TYPES),
    }


@app.get("/api/historical-data")
async def historical_data(ticker: str | None = None, metric_type: str | None = None) -> dict:
    if metric_type is not None and metric_type not in HISTORICAL_METRIC_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de dato historico no soportado.")
    return {
        "items": [
            point.to_dict()
            for point in storage.list_historical_data(ticker=ticker, metric_type=metric_type)
        ],
        "series": storage.list_historical_series(),
    }


@app.post("/api/historical-data")
async def save_historical_data(payload: HistoricalDataRequest) -> dict:
    try:
        point = storage.upsert_historical_data(
            ticker=payload.ticker,
            metric_type=payload.metric_type,
            value_date=payload.value_date,
            value=payload.value,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"item": point.to_dict()}


@app.post("/api/historical-data/upload")
async def upload_historical_data(
    ticker: Annotated[str, Form(min_length=1, max_length=20)],
    file: UploadFile = File(...),
) -> dict:
    rows = await _read_historical_upload(file)
    imported = 0
    errors = []
    for index, row in enumerate(rows, start=2):
        try:
            for metric_type, value in _historical_points_from_row(row):
                storage.upsert_historical_data(
                    ticker=ticker,
                    metric_type=metric_type,
                    value_date=_parse_historical_date(row),
                    value=value,
                )
                imported += 1
        except ValueError as exc:
            errors.append({"row": index, "detail": str(exc)})

    if imported == 0 and errors:
        raise HTTPException(status_code=422, detail=errors[:20])

    return {
        "ticker": ticker.upper().strip(),
        "imported": imported,
        "errors": errors[:20],
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


def _normalize_lecap_settlement(value: str) -> str:
    normalized = value.lower().replace("+", "").replace(" ", "")
    return "t0" if normalized in {"t0", "0", "ci"} else "t1"


def _coerce_optional_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


async def _read_historical_upload(file: UploadFile) -> list[dict[str, object]]:
    name = (file.filename or "").lower()
    content = await file.read()
    if name.endswith((".xlsx", ".xlsm")):
        return _read_excel_upload(content)
    if name.endswith(".xls"):
        raise HTTPException(status_code=422, detail="Formato .xls no soportado. Guardalo como .xlsx o CSV.")
    return _read_csv_upload(content)


def _read_csv_upload(content: bytes) -> list[dict[str, object]]:
    text = content.decode("utf-8-sig")
    sample = text[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [dict(row) for row in reader]


def _read_excel_upload(content: bytes) -> list[dict[str, object]]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise HTTPException(status_code=422, detail="Falta openpyxl para leer Excel.") from exc

    workbook = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(value or "").strip() for value in rows[0]]
    return [
        {headers[index]: value for index, value in enumerate(row) if index < len(headers)}
        for row in rows[1:]
        if any(value is not None and value != "" for value in row)
    ]


def _parse_historical_date(row: dict[str, object]) -> date:
    raw = _pick_value(row, ("fecha", "date", "value_date"))
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    value = str(raw or "").strip()
    for separator in ("/", "-"):
        parts = value.split(separator)
        if len(parts) == 3:
            first, second, third = parts
            if len(first) == 4:
                return date(int(first), int(second), int(third))
            return date(int(third), int(second), int(first))
    raise ValueError("Fecha invalida. Usa DD/MM/AAAA.")


def _historical_points_from_row(row: dict[str, object]) -> list[tuple[str, float]]:
    metric = _normalize_historical_metric(_pick_value(row, ("tipo", "dato", "metric_type", "metric")))
    if metric:
        return [(metric, _parse_float(_pick_value(row, ("valor", "value"))))]

    points = []
    for metric_type, aliases in _HISTORICAL_UPLOAD_COLUMNS.items():
        raw = _pick_value(row, aliases)
        if raw is not None and str(raw).strip() != "":
            points.append((metric_type, _parse_float(raw)))
    if not points:
        raise ValueError("No se encontro ningun valor historico en la fila.")
    return points


def _pick_value(row: dict[str, object], aliases: tuple[str, ...]) -> object | None:
    normalized = {_normalize_header(key): value for key, value in row.items()}
    for alias in aliases:
        value = normalized.get(_normalize_header(alias))
        if value is not None and str(value).strip() != "":
            return value
    return None


def _normalize_historical_metric(value: object | None) -> str | None:
    if value is None:
        return None
    normalized = _normalize_header(str(value))
    alias_map = {
        "paridad": "parity",
        "parity": "parity",
        "precio dirty": "dirty_price",
        "dirty price": "dirty_price",
        "dirty": "dirty_price",
        "precio clean": "clean_price",
        "clean price": "clean_price",
        "clean": "clean_price",
        "tir": "ytm",
        "ytm": "ytm",
        "tem": "tem",
        "tna": "tna",
        "volumen": "volume",
        "volume": "volume",
    }
    return alias_map.get(normalized)


def _normalize_header(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    return ascii_value.replace("_", " ").replace("-", " ")


def _parse_float(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("%", "")
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    return float(text)


_HISTORICAL_UPLOAD_COLUMNS = {
    "parity": ("paridad", "parity"),
    "dirty_price": ("precio dirty", "dirty price", "dirty"),
    "clean_price": ("precio clean", "clean price", "clean"),
    "ytm": ("tir", "ytm"),
    "tem": ("tem",),
    "tna": ("tna",),
    "volume": ("volumen", "volume"),
}
