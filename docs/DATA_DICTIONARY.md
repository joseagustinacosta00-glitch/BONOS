# Diccionario de datos

## Series historicas

La clave logica de una serie historica es:

`ticker base + dato + mercado + liquidacion + fecha`

Ejemplo: `AL30 + ytm + cable + t1 + 2025-01-10`.

## Ticker base

Los tickers se normalizan por familia. `AL30`, `AL30D` y `AL30C` se interpretan como `AL30`.

## Datos soportados

- `parity`: Paridad.
- `dirty_price`: Precio dirty.
- `clean_price`: Precio clean.
- `ytm`: TIR.
- `tem`: TEM.
- `tna`: TNA.
- `volume`: Volumen.

## Mercado y liquidacion

Mercados: `pesos`, `cable`, `mep`.

Liquidaciones: `t0`, `t1`.
