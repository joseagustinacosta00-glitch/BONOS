# Market Data — pyRofex + BCRA

Documentacion del subsistema de market data: cotizaciones en vivo (pyRofex), spot del dolar (DLR/SPOT + A3500), futuros DLR, watchdog del WebSocket y endpoints de diagnostico.

## Fuentes de datos

| Fuente | Tipo | Datos | Frecuencia |
|---|---|---|---|
| pyRofex (WebSocket) | Real-time | Bonos, futuros DLR, spot intraday | Tick a tick (cuando hay) |
| pyRofex (REST) | Pull manual | Mismo + fallback cuando WS no manda | Cada 5s en horario mercado |
| BCRA Estadisticas Monetarias v4 | REST diaria | CER (id=30), TAMAR (id=44), USD A3500 (id=4) | 1 vez por dia (~17:30 ART) |

## Environments de pyRofex

Hay dos environments y la diferencia es critica:

- **VETA** (`api.VETA.xoms.com.ar`) — sandbox/demo. NO hay trades reales. `LA` (last) viene `null`, solo `CL` (cierre) tiene valor. Se usa para desarrollo/testing.
- **LIVE / produccion** (`api.matba.rofex.com.ar`) — ambiente real. `LA` se popula con cada trade durante 10:00-15:00 ART.

El environment se controla por env vars `ROFEX_USER`, `ROFEX_PASSWORD`, `ROFEX_ACCOUNT` y `ROFEX_ENVIRONMENT`.

Para chequear cual estas usando: `GET /api/fx/spot/deep-probe` devuelve `environment_info.rest_url`.

## Spot del dolar (DLR/SPOT)

El simbolo correcto es **`DLR/SPOT`**. La cotizacion intraday del dolar mayorista que opera 10-15h ART.

### Comportamiento del spot por environment

- **VETA**: `DLR/SPOT` existe en el catalogo, pero `LA` siempre viene null. `CL` tiene valor (cierre del dia anterior, ej 1393.0).
- **LIVE**: tanto `LA` (operado en vivo) como `CL` se populan.

Por eso el codigo en `_update_quote_from_message` y `fetch_spot_via_rest` usa **CL como fallback** cuando LA viene null. El frontend muestra `· LA` o `· CL (cierre)` para indicar la fuente.

### Mecanismo de captura

1. **Suscripcion WS al startup** (`_load_spot_catalog` + `_subscribe_in_chunks`):
   - Registra los simbolos de `FORCED_SPOT_SYMBOLS` (`DDF_BCRA_A3500`, `MERV - XMEV - TMUSD - 24hs`, `MERV - XMEV - TMUSD - CI`) sin chequear catalogo.
   - Tambien escanea el catalogo y matchea `SPOT_SYMBOL_CANDIDATES` o heuristica (TMUSD, USA, A3500, etc.).
   - Suscribe al market correcto: `MERV` para simbolos con prefijo "MERV - ...", `ROFX` para el resto.

2. **REST polling cada 5s** (`_spot_rest_poller`):
   - Llama `pyRofex.get_market_data(ticker=DLR/SPOT, market=ROFX)`.
   - Si LA viene null, usa CL como `effective_last`.
   - Persiste en `_spot_quotes_dict` con `last_source = "LA"` o `"CL"`.

3. **Priorizacion en `spot_last()`**:
   - 1° DLR/SPOT con last cargado.
   - 2° cualquier otro spot con last >= 100 (descarta los TMUSD test de 6 pesos).
   - 3° DLR/SPOT aunque no tenga last (al menos el ticker correcto se ve).

## A3500 (BCRA Comunicacion A 3500)

Es el VWAP del dia operado, dato OFICIAL de cierre publicado por BCRA. Una vez al dia ~17:30 ART.

- Variable BCRA: `id_variable=4`.
- Definida en `bcra_client.py` como `usd_mayorista_a3500`.
- Endpoint: `GET /api/fx/spot` devuelve `a3500` separado del `spot_live`.
- Disponible en menu **Datos BCRA** como serie historica (boton "USD A3500").

## Futuros DLR (whitelist)

24 simbolos hardcoded en `ALLOWED_DLR_SYMBOLS`:
```
DLR/MAY26, DLR/MAY26M, DLR/JUN26, DLR/JUN26M, DLR/JUL26, DLR/JUL26M,
DLR/AGO26, DLR/AGO26M, DLR/SEP26, DLR/SEP26M, DLR/OCT26, DLR/OCT26M,
DLR/NOV26, DLR/NOV26M, DLR/DIC26, DLR/DIC26M, DLR/ENE27, DLR/ENE27M,
DLR/FEB27, DLR/FEB27M, DLR/MAR27, DLR/MAR27M, DLR/ABR27, DLR/ABR27M
```

Los terminados en `M` son contratos mayoristas (minimo 1000 contratos).

### Vencimientos calculados

`_dlr_expiration_date(symbol)` parsea el simbolo y calcula el ultimo dia habil del mes correspondiente usando el calendario explicito (`data/business_days.csv`). Ej:
- `DLR/MAY26` -> 29/05/2026
- `DLR/JUN26` -> 30/06/2026
- `DLR/JUL26` -> 31/07/2026

### TNA implicita

`futures_quotes()` calcula automaticamente:
```
tna_percent = ((futuro_last / spot_last) - 1) * 365 / dias_a_vto * 100
change_abs = last - previous_close
```

Solo si tiene `last` y un `spot_last` valido.

## Watchdog del WebSocket

`_watchdog_loop` corre en background cada 60 segundos:

1. Chequea si estamos en horario de mercado (lun-vie 10:30-17:00 ART, respeta calendario explicito).
2. Calcula `_seconds_since_last_tick` (= timestamp del ultimo `_on_market_data`).
3. Si supera 5 minutos en mercado abierto -> dispara `_reconnect_pyrofex` (cierra WS + re-init + re-suscribe todos los chunks).

Esto soluciona el caso donde el server arranca en horario cerrado y el WS nunca recibe ticks cuando abre el mercado.

## Endpoints

### Datos publicos
- `GET /api/fx/spot` — devuelve `{ spot_live, a3500, items, spot }`. `spot` es backward-compat (live > a3500).
- `GET /api/futures` — lista de futuros DLR con `last`, `bid`, `ask`, `bid_size`, `ask_size`, `change`, `change_abs`, `tna_percent`, `expiration`, etc.
- `GET /api/system/quotes-status` — estado del WS, `ws_status`, `ws_last_tick_age_seconds`, `ws_stale`, `ws_is_market_hours`, lista de instrumentos suscriptos.

### Acciones
- `GET|POST /api/futures/rediscover` — re-llama el catalogo y re-suscribe sin redeploy.
- `GET|POST /api/system/reconnect-ws` — fuerza reconexion del WS pyRofex.
- `GET|POST /api/fx/spot/fetch-rest` — fuerza fetch via REST de los simbolos spot suscriptos.

### Diagnostico
- `GET /diag/spot` — pagina HTML con todos los simbolos del catalogo que mencionan DLR/DOLAR/USD, los candidatos de spot, y los suscriptos.
- `GET|POST /api/fx/spot/diagnose` — version JSON del anterior.
- `GET|POST /api/fx/spot/scan?min_price=1000` — escanea TODOS los simbolos del catalogo que parezcan spot, llama REST por cada uno, devuelve los con last razonable.
- `GET|POST /api/fx/spot/probe` — prueba muchas variantes del simbolo (DLR/SPOT, DLR_SPOT, MERV - XMEV - DDF..., etc.) en TODOS los markets.
- `GET|POST /api/fx/spot/deep-probe` — diagnostico exhaustivo: get_market_data con depth 1/5/10, trade_history, HTTP directo bypaseando el SDK, lista de metodos disponibles del SDK.

## Migracion VETA -> LIVE

Cuando se obtenga la cuenta de produccion:

1. En Render -> Environment vars:
   - Cambiar `ROFEX_USER`, `ROFEX_PASSWORD`, `ROFEX_ACCOUNT` a las de produccion.
   - Setear `ROFEX_ENVIRONMENT` = `LIVE` (o el valor que Matba indique).
2. Save Changes -> Render redeployea automaticamente.
3. Verificar `GET /api/fx/spot/deep-probe.environment_info.rest_url` -> debe ser el dominio LIVE (no VETA).
4. Verificar `GET /api/fx/spot.spot_live.last_source` -> deberia empezar a ser `"LA"` cuando hay trades.
5. El sufijo del banner cambia de `· CL (cierre)` a `· LA` automaticamente.

No requiere cambios de codigo.

## Estructura interna

`MarketDataService` (`backend/market_data.py`):

- `_quotes` — bonos (HD, CER, TAMAR, dual, DLK, etc.)
- `_lecap_quotes` — LECAPs por settlement (t0/t1)
- `_caucion_quotes` — cauciones de ARS
- `_futures_quotes` — futuros DLR (whitelist)
- `_spot_quotes_dict` — DLR/SPOT y demas spots
- `_subscription_failed` / `_subscription_succeeded` — set de simbolos por estado
- `_last_tick_ts` — timestamp del ultimo tick recibido (para watchdog)
- `_watchdog_task` / `_spot_poller_task` — async tasks

Tasks async corriendo:
- `_mock_loop` (solo en mock)
- `_watchdog_loop` (60s, reconecta WS si stale)
- `_spot_rest_poller` (5s en mercado, 60s fuera)

## Persistencia

Todo lo que se persiste vive en SQLite via `APP_DB_PATH` (en Render: `/var/data/user_data.db` en disco persistente).

Tablas relevantes para market data:
- `instruments` (Postgres aparte si esta configurado, opcional)
- `market_ticks` (Postgres, scheduler historico)
- `daily_summary` (Postgres, rollup diario)

Ninguna de las cotizaciones en vivo se persisten en SQLite. Solo el cashflow guardado de calculadoras (HD, TAMAR, LECAP) y los datos historicos cargados manualmente.

Backups automaticos cada 5 minutos despues de cualquier write (HD save, LECAP save, historical save) via `_maybe_backup_after_write`. Auto-restore al startup si `db_path` no existe pero hay backups disponibles.
