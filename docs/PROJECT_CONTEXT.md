# Bonos - contexto del proyecto

Bonos es una webapp de mercado para analizar bonos argentinos, LECAPs, datos BCRA, tasas, cauciones y series historicas cargadas por el usuario.

La estructura actual es conservadora:

- Backend: Python con FastAPI.
- Frontend: HTML, CSS y JavaScript estatico.
- Persistencia: SQLite via `APP_DB_PATH`.
- Frontend servido por FastAPI desde `frontend/index.html` y `/static`.

No hay Next.js, React, TypeScript, Tailwind, Vite ni `package.json`.

Los datos cargados por el usuario viven en SQLite local, normalmente `data/user_data.db`, y no deben guardarse en el repositorio.

## Modulos principales

### Mercado en vivo
- pyRofex (WebSocket + REST) para bonos, futuros DLR y spot intraday.
- BCRA (REST) para CER, TAMAR y USD A3500 (cierre VWAP oficial).
- Watchdog del WS que reconecta si los precios estan stale.
- Spot configurado para usar CL como fallback cuando LA viene null (caso VETA sandbox).
- Detalle completo en [MARKET_DATA.md](MARKET_DATA.md).

### Calculadoras (en `Calculadoras` view)
- **LECAP** — bullet capitalizable, cashflow simple.
- **Hard Dollar** — cashflow completo con cupones, amortizacion, gracia, diferimiento de primer pago, step-up/down, importacion de fechas con OCR. Persistencia en `bond_hd_calculations` (UNIQUE por ticker).
- **CER**, **TAMAR**, **Dollar-Linked**, **Tasa fija**, **DUAL** — TAMAR ya operativo (promedio ventana, TEM, VPV, persistencia en `bond_tamar_calculations`); el resto pendientes.

### Mercado (sub-tabs)
- **General**, **FX** (ratios MEP/CCL), **Futuros y DLK**, **Hard Dollar**, **Tasa Fija**, **CER**, **TAMAR**, **Duales**.
- En "Futuros y DLK": banner SPOT LIVE (DLR/SPOT) + A3500 (BCRA), tabla DLK con orden fijo y tabla Futuros DLR con 12 columnas (Sz B, Px B, Px O, Sz O, Last, Δ$, Δ%, V Cn, V N, OI, TNA).
- Click en cualquier ticker en la tabla principal abre modal de metricas (TIR, TNA, TEM, Duration, MD, Convexity) bidireccional precio<->TIR, con auto-conversion ARS->USD via MEP/CCL.

### Calendario de dias habiles
- Hibrido: dentro del rango cubierto por `data/business_days.csv` (oct/2024 - ene/2028, lista oficial del usuario), usa lookup explicito.
- Fuera del rango, fallback weekday-minus-holidays con `data/market_holidays.csv`.

### Persistencia y backups
- SQLite en `APP_DB_PATH` (en Render: `/var/data/user_data.db` en disco persistente).
- Auto-backup post-write con rate limit de 5 min (cada save HD/LECAP/TAMAR/historical).
- Auto-restore en startup si la DB no existe pero hay backups en `data/backups/`.
- Endpoint `POST /api/data/restore-latest` para restore manual.

### Endpoints clave
- `/api/fx/spot` — DLR/SPOT live + A3500 cierre.
- `/api/futures` — futuros DLR ordenados por whitelist con TNA implicita.
- `/api/calculators/bond-hd/...` y `/api/calculators/bond-tamar/...` — CRUD de calculadoras.
- `/api/bcra/series` — series CER, TAMAR y USD A3500.
- `/api/bonds/{ticker}/metrics` — modal de metricas bidireccional.
- `/api/system/quotes-status` — diagnostico del WS.
- `/diag/spot` — pagina HTML de diagnostico del simbolo spot.

Endpoints de diagnostico del market data documentados en [MARKET_DATA.md](MARKET_DATA.md).
