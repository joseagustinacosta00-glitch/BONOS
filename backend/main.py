from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.bonds import BOND_TICKERS
from backend.config import get_settings
from backend.market_data import MarketDataService


ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend"

settings = get_settings()
market = MarketDataService(settings)

app = FastAPI(title="Monitor de Bonos", version="0.1.0")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "market": market.status}


@app.websocket("/ws/quotes")
async def websocket_quotes(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(market.snapshot())
            await asyncio.sleep(1)
    except (WebSocketDisconnect, RuntimeError):
        return
