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

El bono se elige siempre por ticker base en pesos/familia (`AL30`, no `AL30D` ni `AL30C`). Cada carga identifica mercado (`PESOS`, `CABLE`, `MEP`) y liquidacion (`T+0`, `T+1`) para que las bases no se mezclen entre si.

El flujo principal es subir archivos CSV, TXT o XLSX. En la pantalla se selecciona que dato trae el archivo: `Paridad`, `Precio dirty`, `Precio clean`, `TIR`, `TEM`, `TNA` o `Volumen`. El formato recomendado es una fila por fecha con columna `Fecha` en `DD/MM/AAAA` y una columna `Valor`; tambien acepta que la columna de valor se llame igual que el dato seleccionado. Si no encuentra una columna `Valor`, usa la primera columna numerica disponible, ignorando fecha y volumen salvo que el dato seleccionado sea `Volumen`. Si el archivo trae columnas `Mercado` o `Liquidacion`, esas columnas pisan el selector de la pantalla fila por fila. Los historicos quedan guardados en SQLite en `APP_DB_PATH`.

La carga manual de un dato puntual queda aparte como complemento para corregir o agregar observaciones individuales.

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

## Checklist Render: que todo persista

Si la app corre en Render, hay tres componentes separados que cada uno necesita su propia configuracion. Sin esto, los datos se pierden en cada redeploy. Verificar uno por uno:

### Checklist (5 minutos)

1. **Disco persistente para SQLite** (LECAPs, Bonos HD, series historicas, notas IA, backups)
   - Render Dashboard -> servicio web -> Disks -> Add Disk
   - Mount path: `/var/data`, size: 1 GB (~$0.25/mes)
   - Environment -> `APP_DB_PATH=/var/data/user_data.db`
   - Re-deploy

2. **Postgres para market history** (ticks intradia + resumen diario VWAP)
   - Render Dashboard -> New + -> PostgreSQL -> free tier
   - Copiar el "Internal Database URL"
   - Environment del servicio web -> `DATABASE_URL=<el connection string>`
   - Re-deploy

3. **Plan Starter** (la app no se duerme)
   - Render plan Free duerme la app a los 15 min sin trafico = scheduler para de grabar.
   - Para market history continuo durante 10:30-17:00 ART -> plan Starter (~$7/mes).

### Verificacion despues del deploy

Abrir la app y ir a `Datos historicos`: arriba aparece el panel **Estado del sistema** con 4 cards:

- **SQLite**: tiene que decir "Disco persistente: Si" y "Escribible: Si". Si dice "No", el disco no esta montado.
- **Backups**: cantidad > 0 despues del primer arranque.
- **Market history (Postgres)**: "Configurado: Si", "Conectado: Si", "Scheduler: running" (o "outside_market_hours" si estas fuera de 10:30-17:00).
- **Entorno**: confirma `market_source`, horarios y dia habil.

Si ves "Avisos" en amarillo abajo, listan exactamente que falta configurar.

Tambien podes consultar directo el endpoint:
```
GET https://tu-app.onrender.com/api/system/health
GET https://tu-app.onrender.com/api/system/disk-check
```

### Que se guarda donde

| Cosa | Donde vive | Que la borra |
|---|---|---|
| LECAPs guardadas | SQLite (`bond_lecaps`) | Sin disco persistente: cada redeploy |
| Bonos HD calculados | SQLite (`bond_hd_calculations`) | Idem |
| Series historicas (paridad, TIR, etc.) | SQLite (`historical_data`) | Idem |
| Cashflows guardados | SQLite (`calculator_cashflows`) | Idem |
| Notas IA | SQLite (`ai_memory_notes`) | Idem |
| Backups automaticos | `data/backups/` (mismo disco que SQLite) | Idem |
| Ticks intradia (1s/5s) | Postgres (`market_ticks`) | Sin DATABASE_URL: no se guardan |
| Resumen diario VWAP | Postgres (`daily_summary`) | Idem |

Con disco persistente + DATABASE_URL + plan Starter, **nada se pierde nunca** salvo que vos borres explicitamente.

## Como NO perder los datos cargados (politica de backups)

Los datos del usuario (LECAPs guardadas, Bonos HD calculados, series historicas, notas IA) viven en SQLite, en `APP_DB_PATH` (default `data/user_data.db`). Esa base esta fuera del repo (`.gitignore` la cubre). Capas de defensa para que no se pierdan:

### 1. Backup automatico en cada arranque

Cada vez que el backend levanta, copia la base actual a `data/backups/user_data_YYYYMMDD_HHMMSS.db` (rotacion: mantiene los ultimos 30). Si la base principal se rompe, podes recuperar el ultimo backup desde el server.

### 2. Backup descargable en la UI

En la pestaña `Datos historicos` hay un panel "Backup y restauracion" con tres acciones:

- **Descargar backup ahora (.db)**: baja la base entera como `user_data_backup_YYYYMMDD_HHMMSS.db` a tu PC.
- **Descargar backup JSON**: exporta todas las tablas como JSON portable (independiente del binario SQLite).
- **Crear backup en el server**: dispara una copia manual a `data/backups/`.

Los `.db` descargados son tu copia "sagrada". Guardalos en Drive/Dropbox/disco externo.

### 3. Restauracion

En el mismo panel, "Restaurar desde archivo .db" sube un backup previo. Antes de pisar la base actual, el server hace un backup defensivo de la base existente (`data/backups/pre_restore_*.db`), asi nunca se pierde lo previo.

### 4. Render con disco persistente (CRITICO si deployas)

**Sin disco persistente, cada redeploy de Render borra el filesystem y por lo tanto la base.** Para evitar:

1. Render Dashboard -> tu servicio web -> Disks -> Add Disk.
2. Mount path: `/var/data` (o el que prefieras).
3. Tamaño: 1 GB es suficiente para empezar.
4. En Environment, configurar `APP_DB_PATH=/var/data/user_data.db`.
5. Re-deploy.

Costo: el disco mas chico (1 GB) cuesta ~$0.25/mes en Render.

Sin disco persistente, las dos defensas anteriores se pierden tambien (los backups en `data/backups/` viven en el filesystem efimero).

### 5. Endpoints utiles

- `GET /api/data/backup/download` -> descarga `.db`.
- `GET /api/data/backup/json` -> exporta JSON.
- `GET /api/data/backups` -> lista de backups en el server.
- `POST /api/data/backup/now` -> dispara backup manual.
- `POST /api/data/restore` -> restaura desde `.db` subido (multipart/form-data, campo `file`).

## Base historica de mercado propia

La app puede grabar ticks de mercado en su propia base Postgres durante el horario operativo (10:30-17:00 ART, dias habiles segun `data/market_holidays.csv`) y calcular un resumen diario al cierre con OHLC, VWAP, monto operado y VN operados por instrumento.

### Schema (time-series friendly, compatible con TimescaleDB)

- `instruments`: catalogo (symbol, family, category, currency, snapshot_interval_seconds, metadata).
- `market_ticks`: registros (ts, instrument_id, last, delta_volume, cumulative_volume). PK (ts, instrument_id), indice (instrument_id, ts DESC).
- `daily_summary`: agregado diario (trade_date, instrument_id, open/high/low/close, vwap, total_amount, total_volume_nominal, trades_count). PK (trade_date, instrument_id).

El esquema se crea solo en el primer arranque con `CREATE TABLE IF NOT EXISTS`. Para escalar a TimescaleDB en el futuro:

```sql
CREATE EXTENSION timescaledb;
SELECT create_hypertable('market_ticks', 'ts', migrate_data => TRUE);
ALTER TABLE market_ticks SET (timescaledb.compress);
SELECT add_compression_policy('market_ticks', INTERVAL '30 days');
```

Sin tocar codigo: el SQL del scheduler funciona en Postgres comun y en TimescaleDB.

### Cadencias por categoria

- `bond_hd`: 1 segundo
- `caucion`: 1 segundo
- `lecap`, `cer`, `tamar`, `dual`, `bond_other`: 5 segundos

El scheduler solo graba cuando cambia el `last` o aumenta el `cumulative_volume`. Snapshots redundantes se descartan, asi VWAP queda exacto.

### Setup en Render

1. En el panel Render, crear una base **PostgreSQL** (free tier 90 dias, despues ~$7/mes).
2. Copiar el `Internal Database URL` que da Render.
3. En el servicio web, env var: `DATABASE_URL=<el connection string>` (o `MARKET_HISTORY_DATABASE_URL` si preferis explicito).
4. La app necesita estar siempre encendida durante el horario de mercado: usar plan **Starter** (~$7/mes) y desactivar auto-sleep.

### Variables de entorno

```env
MARKET_HISTORY_ENABLED=true              # default true; ponelo en false para apagar el pipeline
DATABASE_URL=postgresql://...            # connection string de Postgres
MARKET_OPEN_LOCAL=10:30                  # horario ART de apertura (HH:MM)
MARKET_CLOSE_LOCAL=17:00                 # horario ART de cierre (HH:MM)
MARKET_HISTORY_BATCH_SECONDS=15          # cada cuantos segundos se vuelca el batch a la DB
```

### Endpoints

- `GET /api/market-history/health`: estado del pipeline (conectado, ticks_today, last_tick_ts, last_summary_date, scheduler_status).
- `GET /api/market-history/instruments`: listado de instrumentos catalogados.
- `GET /api/market-history/ticks?symbol=AL30D&date_from=...&date_to=...&interval_seconds=60`: ticks crudos o agregados por bucket.
- `GET /api/market-history/daily?symbol=AL30D&date_from=...&date_to=...`: resumen diario.
- `POST /api/market-history/rollup?target=YYYY-MM-DD`: recalcula manualmente el daily_summary de un dia (idempotente).
- `GET /api/market-history/export?symbol=...&date_from=...&date_to=...&format=csv|parquet`: descarga.

### Sobre VWAP

VWAP del dia se calcula como `Σ(last × delta_volume) / Σ(delta_volume)` usando los ticks reales (no los snapshots redundantes). Se ejecuta automaticamente a las 17:05 ART (5 minutos despues del cierre) y queda persistido en `daily_summary`.

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
