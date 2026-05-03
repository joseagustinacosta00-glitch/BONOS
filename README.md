# Monitor de Bonos

Webapp simple para monitorear bonos hard dollar ley local con frontend HTML/CSS/JS + Bootstrap y backend Python + FastAPI.

## Tickers iniciales

AO27, AO27D, AO27C, AL29, AL29D, AL29C, AL30, AL30D, AL30C, AL35, AL35D, AL35C, AE38, AE38D, AE38C, AL41, AL41D, AL41C.

## Conexion con pyRofex

`pyRofex` conecta con las APIs REST y WebSocket de Matba Rofex / Primary.

Flujo usado por esta app:

1. Inicializar ambiente con `pyRofex.initialize(user, password, account, environment)`.
2. Pedir un primer snapshot REST con `pyRofex.get_market_data(...)`.
3. Abrir WebSocket con `pyRofex.init_websocket_connection(...)`.
4. Suscribirse a market data con `pyRofex.market_data_subscription(...)`.
5. Procesar mensajes `MD` recibidos en el handler de mercado.

La app solo pide datos de mercado. No envia ordenes.

## Instalacion

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Las variables reales se leen desde `.env`. El archivo `.env.example` queda solo como plantilla para subir a GitHub sin secretos.

## Variables

Modo demo local:

```env
MARKET_SOURCE=mock
APP_DB_PATH=data/user_data.db
```

Modo real o remarket con pyRofex:

```env
MARKET_SOURCE=pyrofex
ROFEX_ENVIRONMENT=REMARKET
ROFEX_REST_URL=https://api.VETA.xoms.com.ar/
ROFEX_WS_URL=wss://api.VETA.xoms.com.ar/
ROFEX_USER=tu_usuario
ROFEX_PASSWORD=tu_password
ROFEX_ACCOUNT=tu_cuenta
ROFEX_MARKET=ROFEX
ROFEX_SETTLEMENT=24hs
ROFEX_SETTLEMENT_T0=CI
ROFEX_SETTLEMENT_T1=24hs
ROFEX_SYMBOL_TEMPLATE=MERV - XMEV - {symbol} - {settlement}
ROFEX_CAUCION_SYMBOLS=PESOS - 1D,PESOS - 4D
APP_DB_PATH=data/user_data.db
```

Para VETA, usar `ROFEX_ENVIRONMENT=LIVE` junto con `ROFEX_REST_URL` y `ROFEX_WS_URL`. La app pisa esas URLs en `pyRofex.Environment.LIVE` antes de llamar a `pyRofex.initialize(...)`.

En deploy, revisa que no queden cruzadas:

- `ROFEX_REST_URL` debe empezar con `https://`
- `ROFEX_WS_URL` debe empezar con `wss://`

## Probar pyRofex sin la webapp

```powershell
python scripts\pyrofex_probe.py
```

El script hace login, prueba snapshots REST para todos los bonos y abre una suscripcion WebSocket durante 30 segundos. Si queres cambiar ese tiempo:

```powershell
$env:ROFEX_PROBE_SECONDS="60"
python scripts\pyrofex_probe.py
```

Si el formato de simbolo no coincide con tu ambiente, vas a ver errores por instrumento. En ese caso hay que revisar `ROFEX_SYMBOL_TEMPLATE`.

Para descubrir los nombres exactos de instrumentos se puede usar `pyRofex.get_all_instruments()` o `pyRofex.get_instruments('by_cfi', cfi_code=[pyRofex.CFICode.BOND])` en un script auxiliar.

## Levantar la webapp

Modo mock:

```powershell
$env:MARKET_SOURCE="mock"
uvicorn backend.main:app --reload
```

Modo pyRofex:

```powershell
$env:MARKET_SOURCE="pyrofex"
uvicorn backend.main:app --reload
```

Abrir http://127.0.0.1:8000

## Endpoints

- `GET /api/tickers`: universo de instrumentos.
- `GET /api/quotes`: ultimo snapshot.
- `GET /api/bonds/{family}/cashflows`: flujos futuros hard dollar para AO27, AL29, AL30, AL35, AE38 y AL41.
- `GET /api/bonds/{family}/ytm?price=80`: calcula TIR anual efectiva hard dollar para un precio en USD/CCL.
- `GET /api/calendar/summary`: resumen del calendario cargado.
- `GET /api/calendar/day/YYYY-MM-DD`: indica si una fecha es feriado y dia habil.
- `GET /api/calendar/business-days?start=YYYY-MM-DD&end=YYYY-MM-DD`: dias habiles entre fechas.
- `GET /api/bcra/catalog`: series BCRA disponibles en la app.
- `GET /api/bcra/series?limit=700`: CER y TAMAR historico reciente.
- `GET /api/bcra/series?refresh=true`: fuerza actualizacion desde BCRA.
- `GET /api/bcra/series/cer?limit=0`: serie CER completa.
- `GET /api/bcra/series/tamar_private_banks_na?limit=0`: serie TAMAR n.a. completa.
- `GET /api/market/lecaps?settlement=t0|t1`: LECAPs guardadas con precios y metricas de mercado.
- `GET /api/market/caucion/shortest`: caucion ARS de menor plazo detectada para tasa automatica.
- `GET /api/market/cauciones`: lista de cauciones ARS configuradas o detectadas por pyRofex.
- `POST /api/tools/tplus-conversion`: capitaliza o descuenta precios entre T+0 y T+1.
- `POST /api/calculators/bond-draft`: crea la base inicial de un bono para calculadoras.
- `GET /api/calculators/lecaps/tickers`: tickers LECAP cargados.
- `POST /api/calculators/lecaps`: calcula el cashflow fijo de emision para una LECAP.
- `GET /api/calculators/lecaps/saved`: lista LECAPs guardadas por vencimiento.
- `POST /api/calculators/lecaps/saved`: confirma y guarda una LECAP.
- `GET /api/calculators/cashflows`: lista flujos fijos guardados por calculadora/ticker.
- `GET /api/data/tickers`: lista tickers conocidos y cargados por el usuario.
- `GET /api/historical-data`: lista datos historicos cargados por ticker/tipo.
- `POST /api/historical-data`: guarda un dato historico manual.
- `POST /api/historical-data/upload`: importa datos historicos desde CSV/TXT/XLSX.
- `WS /ws/quotes`: snapshot continuo para la UI.

## Calendario y Modelos

Los timestamps del backend y la UI usan `America/Argentina/Buenos_Aires`.

La base de feriados esta en `data/market_holidays.csv` con el calendario 2020-2026 cargado. El motor de calendario esta en `backend/market_calendar.py`.

`data/business_days.csv` queda preparado para cargar un calendario explicito de ruedas habiles. Si ese archivo tiene fechas, el sistema lo usa como fuente mandatoria; si esta vacio, calcula lunes a viernes menos feriados.

La base de modelos para calculadoras esta en `backend/bond_calculators.py` y el menu contempla:

- LECAP
- bono HD
- CER
- TAMAR
- tasa fija
- DUAL, con subtipos CER, TAMAR y FIJA

El template operativo de carga esta disponible solo dentro de `LECAP`. Las otras calculadoras quedan separadas en el menu para no reutilizar el formulario de LECAP donde no corresponde.

Dentro de `LECAP` esta cargado el subtipo `LECAPs` con estos tickers: S15Y6, S29Y6, T30J6, S17L6, S31L6, S14G6, S31G6, S30S6 y S30O6.

Para LECAPs se pide ticker, fecha de emision, fecha de vencimiento, VNO y TEM de emision. El cashflow es bullet a vencimiento, ajusta fecha de pago al siguiente dia habil si hace falta y calcula interes con:

```text
VNO * (1 + TEM) ^ (dias / 30) - VNO
```

La solapa permite confirmar y guardar cada LECAP. Esos datos y el flujo fijo calculado se guardan en SQLite en `APP_DB_PATH` y no forman parte del codigo ni del repo, asi podes actualizar archivos del proyecto sin perder las calculadoras cargadas. En local, `data/user_data.db` queda ignorado por Git.

La solapa `Datos historicos` permite cargar por ticker un valor de:

- Paridad
- Precio dirty
- Precio clean
- TIR
- TEM
- TNA
- Volumen

El ticker se puede elegir desde el listado de instrumentos conocidos o escribir manualmente. Cada carga identifica mercado (`PESOS`, `CABLE`, `MEP`) y liquidacion (`T+0`, `T+1`) para que las bases no se mezclen entre si.

Tambien se pueden subir archivos CSV, TXT o XLSX. El formato recomendado es una fila por fecha con columna `Fecha` en `DD/MM/AAAA` y columnas de valores disponibles: `Paridad`, `Precio dirty`, `Precio clean`, `TIR`, `TEM`, `TNA` y `Volumen`. Tambien acepta formato largo con columnas `Fecha`, `Tipo` y `Valor`; si el archivo trae columnas `Mercado` o `Liquidacion`, esas columnas pisan el selector de la pantalla fila por fila. Los historicos quedan guardados en SQLite en `APP_DB_PATH`.

Debajo de la carga, la UI muestra las series disponibles por familia/ticker, dato, mercado y liquidacion. Cada serie se puede ver u ocultar, buscar por familia o ticker y descargar como CSV.

El template de `Bono HD` queda preparado con inputs de fecha de emision, fecha de vencimiento, frecuencia y tipo de cupon. Si el cupon es fijo se carga un solo valor anual; si es step-up, la UI abre una lista de anios segun emision y vencimiento para cargar el cupon de cada anio.

En la solapa `Mercado`, el selector `LECAPs` muestra las LECAPs guardadas con precios T+0 o T+1. La TNA se calcula para bid, offer y last; TIR, TEM, duration, modified duration y convexity se calculan contra last.

La solapa `Tasas` muestra automaticamente la caucion ARS de menor plazo configurada o detectada por pyRofex. Por defecto usa `PESOS - 1D` y `PESOS - 4D`, elige siempre la de menor cantidad de dias y esa misma tasa se usa en `T+0 / T+1`.

La solapa `T+0 / T+1` usa la caucion ARS de plazo mas corto por `last` como tasa automatica. Si tu ambiente usa nombres especiales, carga `ROFEX_CAUCION_SYMBOLS` con uno o mas simbolos separados por coma.

## Datos BCRA

La solapa `Datos BCRA` consume la API publica de Estadisticas Monetarias v4 del BCRA.

Series iniciales:

- `idVariable=30`: CER, coeficiente de estabilizacion de referencia, base 2.2.02=1.
- `idVariable=44`: TAMAR de bancos privados en porcentaje nominal anual.

El cliente esta en `backend/bcra_client.py`, pagina hasta 3000 registros por request y guarda cache en memoria por `BCRA_CACHE_TTL_SECONDS`.

## Deploy

La app esta preparada para deploy como proceso web persistente. No conviene usar serverless puro porque el market data real mantiene una conexion WebSocket contra Primary.

### Docker

Build local:

```powershell
docker build -t monitor-bonos .
```

Run mock:

```powershell
docker run --rm -p 8000:8000 -e MARKET_SOURCE=mock monitor-bonos
```

Run pyRofex:

```powershell
docker run --rm -p 8000:8000 --env-file .env monitor-bonos
```

### PaaS tipo Render/Railway/Fly

Usa cualquiera de estas dos formas:

- Docker: el proveedor detecta el `Dockerfile`.
- Python web service: usa el `Procfile` o el comando `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.

Configura las variables de entorno en el panel del proveedor. Si vas a usar `MARKET_SOURCE=pyrofex`, elegi un servicio siempre encendido o con auto-sleep desactivado, porque si la instancia duerme se corta el stream.

Para que las LECAPs guardadas sobrevivan redeploys en Render/Railway/Fly, configura un disco persistente y apunta `APP_DB_PATH` a ese volumen. En local queda en `data/user_data.db`.

## TIR Hard Dollar

La pantalla calcula `TIR` para las especies hard dollar cotizadas en USD o Cable usando cashflows futuros cargados para AO27, AL29, AL30, AL35, AE38 y AL41. Las especies en ARS quedan sin TIR porque hace falta convertir el precio a moneda de flujo con un tipo de cambio consistente antes de descontar.
