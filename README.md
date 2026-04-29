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

Por pedido del proyecto, las variables se leen desde `.env.example`.

## Variables

Modo demo local:

```env
MARKET_SOURCE=mock
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
ROFEX_SYMBOL_TEMPLATE=MERV - XMEV - {symbol} - {settlement}
```

Para VETA, usar `ROFEX_ENVIRONMENT=LIVE` junto con `ROFEX_REST_URL` y `ROFEX_WS_URL`. La app pisa esas URLs en `pyRofex.Environment.LIVE` antes de llamar a `pyRofex.initialize(...)`.

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
- `WS /ws/quotes`: snapshot continuo para la UI.

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
docker run --rm -p 8000:8000 --env-file .env.example monitor-bonos
```

### PaaS tipo Render/Railway/Fly

Usa cualquiera de estas dos formas:

- Docker: el proveedor detecta el `Dockerfile`.
- Python web service: usa el `Procfile` o el comando `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.

Configura las variables de entorno en el panel del proveedor. Si vas a usar `MARKET_SOURCE=pyrofex`, elegi un servicio siempre encendido o con auto-sleep desactivado, porque si la instancia duerme se corta el stream.

## TIR

La pantalla ya deja la columna `TIR`, pero por ahora queda sin dato porque para calcularla bien hacen falta los flujos de cada bono, fechas de amortizacion, cupones y convencion de precio. El siguiente paso natural es cargar esos cashflows y calcular TIR desde el ultimo precio recibido.
