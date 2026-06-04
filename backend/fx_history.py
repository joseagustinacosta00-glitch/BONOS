"""Captura intraday de cotizaciones FX (Spot, A3500, MEP, CCL) y endpoints
de history + averages. Usa el mismo SQLite de CalculatorStorage (APP_DB_PATH).

Tabla fx_snapshots:
    ts (ISO con tz local AR), spot, a3500,
    mep_bid, mep_last, mep_offer,
    ccl_bid, ccl_last, ccl_offer,
    canje_last (= (ccl_last/mep_last - 1) * 100, en pp).

Ventanas de captura por componente (solo en dia habil):
    - Spot / A3500:           10:00 - 15:00  (mercado mayorista USD)
    - MEP / CCL / canje:      10:30 - 17:00  (mercado de bonos)

Fuera de esas franjas las columnas correspondientes se guardan como NULL.
Si TODAS quedan NULL no se inserta. Si afuera de 10:00-17:00 directamente
se duerme largo sin samplear.
"""
from __future__ import annotations

import asyncio
import logging
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, time, timedelta

# Usamos la TZ del resto del app (Argentina) para que los buckets/labels
# coincidan con los timestamps de quotes/futuros que ya guarda el backend.
try:
    from backend.time_utils import now_argentina
    def _now() -> datetime:
        return now_argentina().replace(tzinfo=None)  # naive AR para SQLite
except Exception:
    def _now() -> datetime:
        return datetime.now()
from pathlib import Path
from typing import Any, Iterable

logger = logging.getLogger(__name__)


SAMPLE_SECONDS = 5
RETENTION_DAYS = 730  # 2 anios

# Ventanas (hora local AR). Editar aca centraliza la politica.
SPOT_OPEN  = time(10, 0)
SPOT_CLOSE = time(15, 0)
BONOS_OPEN  = time(10, 30)
BONOS_CLOSE = time(17, 0)
# Ventana global (union): fuera de aca el loop duerme largo.
WIDE_OPEN  = time(10, 0)
WIDE_CLOSE = time(17, 0)


def _in_spot_window(when: datetime) -> bool:
    t = when.time()
    return SPOT_OPEN <= t <= SPOT_CLOSE


def _in_bonos_window(when: datetime) -> bool:
    t = when.time()
    return BONOS_OPEN <= t <= BONOS_CLOSE


def _in_wide_window(when: datetime) -> bool:
    t = when.time()
    return WIDE_OPEN <= t <= WIDE_CLOSE


def _is_business_day(when: datetime) -> bool:
    """True si es dia habil ART. Cae al market_calendar si esta disponible;
    sino chequea solo sab/dom."""
    try:
        from backend.market_calendar import market_calendar
        return market_calendar.is_business_day(when.date())
    except Exception:
        return when.weekday() < 5


@dataclass(frozen=True)
class FxSnapshot:
    ts: str  # ISO con tz
    spot: float | None
    a3500: float | None
    mep_bid: float | None
    mep_last: float | None
    mep_offer: float | None
    ccl_bid: float | None
    ccl_last: float | None
    ccl_offer: float | None
    canje_last: float | None  # en pp


class FxHistoryStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn, conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS fx_snapshots (
                    ts TEXT PRIMARY KEY,
                    spot REAL,
                    a3500 REAL,
                    mep_bid REAL,
                    mep_last REAL,
                    mep_offer REAL,
                    ccl_bid REAL,
                    ccl_last REAL,
                    ccl_offer REAL,
                    canje_last REAL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fx_snapshots_ts ON fx_snapshots (ts DESC)"
            )

    # ---------- Insert ----------
    def insert(self, snap: FxSnapshot) -> None:
        # Si todos los valores son None, no insertamos para no llenar la tabla
        if all(v is None for v in (
            snap.spot, snap.a3500,
            snap.mep_bid, snap.mep_last, snap.mep_offer,
            snap.ccl_bid, snap.ccl_last, snap.ccl_offer,
            snap.canje_last,
        )):
            return
        with closing(self._connect()) as conn, conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO fx_snapshots
                (ts, spot, a3500, mep_bid, mep_last, mep_offer,
                 ccl_bid, ccl_last, ccl_offer, canje_last)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    snap.ts, snap.spot, snap.a3500,
                    snap.mep_bid, snap.mep_last, snap.mep_offer,
                    snap.ccl_bid, snap.ccl_last, snap.ccl_offer,
                    snap.canje_last,
                ),
            )

    # ---------- Queries ----------
    def get_average(self, window_minutes: int) -> dict[str, dict[str, float | None]]:
        """Promedio simple sobre los snapshots de los ultimos N minutos.
        Devuelve { t0: {mep, ccl, canje}, t1: {...} }.
        T+0 y T+1 reciben los mismos valores hasta que diferenciemos por settlement.
        """
        cutoff = (_now() - timedelta(minutes=window_minutes)).isoformat()
        with closing(self._connect()) as conn:
            row = conn.execute(
                """
                SELECT
                    AVG(mep_last)   AS mep_last,
                    AVG(ccl_last)   AS ccl_last,
                    AVG(canje_last) AS canje_last
                FROM fx_snapshots
                WHERE ts >= ?
                """,
                (cutoff,),
            ).fetchone()
        if not row:
            return {"t0": {}, "t1": {}}
        block = {
            "mep":   row["mep_last"],
            "ccl":   row["ccl_last"],
            "canje": row["canje_last"],
        }
        return {"t0": block, "t1": block}

    def get_tc_history(self, instr: str, field: str, period: str) -> dict[str, Any]:
        """Devuelve serie de TC para Chart de evolucion.
        instr: 'MEP' | 'CCL' | 'Canje'
        field: 'last' | 'bid' | 'offer'
        period: '5D' | '1M' | '3M' | '6M' | 'YTD' | '1A'
        Output: { series: [{label, value}], min, max, variation }
        """
        col = self._tc_column(instr, field)
        if not col:
            return {"series": [], "min": None, "max": None, "variation": None}
        cutoff = self._period_cutoff(period)
        bucket_seconds = self._bucket_seconds(period)
        return self._query_bucketed(col, cutoff, bucket_seconds)

    def get_brecha_history(self, op: str, num: str, den: str, period: str) -> dict[str, Any]:
        """Devuelve serie de brecha para Chart.
        op: 'spread' | 'relativo'
        num/den: 'MEP' | 'CCL' | 'Spot'
        Cuando den='Spot':
          - Para fechas pasadas (DATE(ts) < hoy): usa a3500 como denominador
          - Para hoy: usa spot live
        Esto evita que el historial quede vacio (la captura intraday recien
        empezo, los snapshots viejos del backfill solo tienen a3500/AL30).
        Relativo se devuelve YA en porcentaje: ((num/den) - 1) * 100.
        """
        col_num = self._tc_column(num, "last") or self._spot_column(num)
        if not col_num:
            return {"series": [], "min": None, "max": None, "variation": None}

        # Construir denominador con switch a3500/spot segun fecha
        den_l = (den or "").lower()
        if den_l == "spot":
            today_str = _now().strftime("%Y-%m-%d")
            col_den = f"(CASE WHEN substr(ts, 1, 10) = '{today_str}' THEN spot ELSE a3500 END)"
        else:
            col_den = self._tc_column(den, "last") or self._spot_column(den)
            if not col_den:
                return {"series": [], "min": None, "max": None, "variation": None}

        if op == "spread":
            expr = f"({col_num} - {col_den})"
        elif op == "relativo":
            expr = f"CASE WHEN {col_den} != 0 THEN (({col_num} / {col_den}) - 1) * 100 ELSE NULL END"
        else:
            return {"series": [], "min": None, "max": None, "variation": None}
        cutoff = self._period_cutoff(period)
        bucket_seconds = self._bucket_seconds(period)
        return self._query_bucketed(
            expr, cutoff, bucket_seconds,
            where_extra=f"{col_num} IS NOT NULL AND {col_den} IS NOT NULL",
        )

    def get_value_at(
        self,
        kind: str,
        instr: str | None = None,
        field: str | None = None,
        op: str | None = None,
        num: str | None = None,
        den: str | None = None,
        at_iso: str | None = None,
    ) -> dict[str, Any]:
        """Lookup de un valor a un datetime especifico.
        kind=tc: usa instr (mep|ccl|canje|spot|a3500) + field (last|bid|offer)
        kind=brecha: usa op (spread|relativo) + num + den
        Devuelve el snapshot mas cercano <= at_iso (o el ultimo si no se pasa).
        Output: { value, ts, requested }
        """
        if at_iso is None:
            at_iso = _now().isoformat()
        # Construir expresion segun kind
        if kind == "tc":
            instr_l = (instr or "").lower()
            field_l = (field or "last").lower()
            if instr_l in ("spot", "a3500"):
                expr = self._spot_column(instr_l)
            elif instr_l == "canje":
                expr = "canje_last"
            elif instr_l in ("mep", "ccl"):
                if field_l in ("last", "bid", "offer"):
                    expr = f"{instr_l}_{field_l}"
                else:
                    return {"value": None, "ts": None, "requested": at_iso, "error": "field invalido"}
            else:
                return {"value": None, "ts": None, "requested": at_iso, "error": "instr invalido"}
            if not expr:
                return {"value": None, "ts": None, "requested": at_iso, "error": "campo no soportado"}
        elif kind == "brecha":
            col_num = self._tc_column(num or "", "last") or self._spot_column(num or "")
            if not col_num:
                return {"value": None, "ts": None, "requested": at_iso, "error": "leg invalido"}
            # Mismo switch que get_brecha_history: a3500 historico, spot hoy
            den_l = (den or "").lower()
            if den_l == "spot":
                today_str = _now().strftime("%Y-%m-%d")
                col_den = f"(CASE WHEN substr(ts, 1, 10) = '{today_str}' THEN spot ELSE a3500 END)"
            else:
                col_den = self._tc_column(den or "", "last") or self._spot_column(den or "")
                if not col_den:
                    return {"value": None, "ts": None, "requested": at_iso, "error": "leg invalido"}
            if op == "spread":
                expr = f"({col_num} - {col_den})"
            elif op == "relativo":
                expr = f"CASE WHEN {col_den} != 0 THEN (({col_num} / {col_den}) - 1) * 100 ELSE NULL END"
            else:
                return {"value": None, "ts": None, "requested": at_iso, "error": "op invalido"}
        else:
            return {"value": None, "ts": None, "requested": at_iso, "error": "kind invalido"}

        sql = f"""
            SELECT ts, ({expr}) AS val
            FROM fx_snapshots
            WHERE ts <= ? AND ({expr}) IS NOT NULL
            ORDER BY ts DESC
            LIMIT 1
        """
        with closing(self._connect()) as conn:
            row = conn.execute(sql, (at_iso,)).fetchone()
        if not row:
            return {"value": None, "ts": None, "requested": at_iso}
        return {
            "value": float(row["val"]) if row["val"] is not None else None,
            "ts": row["ts"],
            "requested": at_iso,
        }

    def backfill_from_historical(self, settlement: str = "t1", bcra_client: Any = None) -> dict[str, int]:
        """Lee historical_data y deriva MEP/CCL para cada fecha disponible
        cuando hay AL30 (pesos), AL30/AL30D (usd/mep) y/o AL30C (cable).
        Inserta los puntos derivados en fx_snapshots con ts = mediodia local.
        Soporta dos esquemas de upload comunes:
        - ticker=AL30 + price_market en (pesos|usd|mep|cable)
        - tickers separados AL30 / AL30D / AL30C con price_market='unspecified'
        Filtra por settlement (t0 o t1) para evitar mezclar plazos en el mismo
        snapshot. Default 't1' (estandar para historico).
        Si bcra_client se provee, ademas pobla a3500 por fecha desde la serie
        usd_mayorista_a3500 (clave para el calculo de brechas historicas).
        Devuelve estadisticas: { dates_seen, inserted, skipped, a3500_filled }.
        """
        settlement = settlement if settlement in ("t0", "t1") else "t1"

        # Pull A3500 historico desde BCRA (si esta disponible) y armar map por fecha.
        a3500_by_date: dict[str, float] = {}
        if bcra_client is not None:
            try:
                payload = bcra_client.get_series("usd_mayorista_a3500")
                for p in payload.get("data") or []:
                    d = str(p.get("date") or "")
                    v = p.get("value")
                    if d and v is not None:
                        try: a3500_by_date[d] = float(v)
                        except (TypeError, ValueError): pass
            except Exception:
                logger.exception("[fx_history] backfill: no se pudo cargar A3500 de BCRA")

        with closing(self._connect()) as conn:
            rows = conn.execute(
                """
                SELECT ticker, price_market, value_date, value, settlement_type
                FROM historical_data
                WHERE metric_type = 'dirty_price'
                  AND ticker IN ('AL30', 'AL30D', 'AL30C')
                  AND settlement_type = ?
                ORDER BY value_date
                """,
                (settlement,),
            ).fetchall()

        # Indexar por fecha: { date: { 'pesos': v, 'usd': v, 'cable': v } }
        by_date: dict[str, dict[str, float]] = {}
        for r in rows:
            date_str = str(r["value_date"])
            ticker = str(r["ticker"]).upper()
            pm = str(r["price_market"] or "").lower()
            try:
                v = float(r["value"])
            except (TypeError, ValueError):
                continue
            if v <= 0:
                continue
            bucket = by_date.setdefault(date_str, {})
            # Preferimos el ticker explicito (AL30D/AL30C) sobre el price_market
            if ticker == "AL30D":
                bucket["usd"] = v
            elif ticker == "AL30C":
                bucket["cable"] = v
            elif ticker == "AL30":
                if pm in ("pesos", "ars", "unspecified", ""):
                    bucket["pesos"] = v
                elif pm in ("usd", "dolar", "mep"):
                    bucket["usd"] = v
                elif pm == "cable":
                    bucket["cable"] = v

        inserted = 0
        skipped = 0
        a3500_filled = 0
        # Tambien insertamos snapshots solo de A3500 para fechas donde hay BCRA pero no AL30,
        # asi el grafico de A3500 historico tambien queda disponible.
        all_dates = set(by_date.keys()) | set(a3500_by_date.keys())
        for date_str in sorted(all_dates):
            b = by_date.get(date_str, {})
            pesos = b.get("pesos")
            usd   = b.get("usd")
            cable = b.get("cable")
            mep_last = (pesos / usd) if (pesos is not None and usd not in (None, 0)) else None
            ccl_last = (pesos / cable) if (pesos is not None and cable not in (None, 0)) else None
            canje_last = None
            if mep_last is not None and ccl_last is not None and mep_last != 0:
                canje_last = ((ccl_last / mep_last) - 1) * 100
            a3500_val = a3500_by_date.get(date_str)
            if mep_last is None and ccl_last is None and a3500_val is None:
                skipped += 1
                continue
            # Timestamp = mediodia local del dia historico
            ts = f"{date_str}T12:00:00"
            snap = FxSnapshot(
                ts=ts, spot=None, a3500=a3500_val,
                mep_bid=None, mep_last=mep_last, mep_offer=None,
                ccl_bid=None, ccl_last=ccl_last, ccl_offer=None,
                canje_last=canje_last,
            )
            try:
                self.insert(snap)
                inserted += 1
                if a3500_val is not None: a3500_filled += 1
            except Exception:
                skipped += 1
        return {
            "dates_seen": len(all_dates),
            "inserted": inserted,
            "skipped": skipped,
            "a3500_filled": a3500_filled,
        }

    def cleanup(self) -> int:
        """Borra snapshots mas viejos que RETENTION_DAYS. Devuelve cantidad borrada."""
        cutoff = (_now() - timedelta(days=RETENTION_DAYS)).isoformat()
        with closing(self._connect()) as conn, conn:
            cur = conn.execute("DELETE FROM fx_snapshots WHERE ts < ?", (cutoff,))
        return cur.rowcount

    def cleanup_outside_window(self) -> dict[str, int]:
        """Aplica retroactivamente las ventanas de captura sobre fx_snapshots:

        - Borra filas en dias no habiles (sab/dom/feriados).
        - Borra filas con hora fuera de [10:00, 17:00].
        - NULL-ifica MEP/CCL/canje en filas con hora en [10:00, 10:30) (fuera
          de su ventana 10:30-17).
        - NULL-ifica spot/a3500 en filas con hora en (15:00, 17:00] (fuera de
          su ventana 10:00-15).
        - Borra filas resultantes que quedan todas NULL.

        DESTRUCTIVO. Devuelve stats con cuantas filas afecto cada paso.
        """
        stats = {
            "deleted_non_business_day": 0,
            "deleted_outside_wide_window": 0,
            "nullified_bonos_early": 0,
            "nullified_spot_late": 0,
            "deleted_all_null": 0,
        }
        with closing(self._connect()) as conn, conn:
            # 1) Dias no habiles. SQLite no sabe de feriados ART asi que
            #    pasamos por Python: listamos fechas distintas y filtramos.
            cur = conn.execute("SELECT DISTINCT substr(ts, 1, 10) AS d FROM fx_snapshots")
            all_dates = [row[0] for row in cur.fetchall()]
            try:
                from backend.market_calendar import market_calendar
                from datetime import date as _date
                non_business: list[str] = []
                for d_str in all_dates:
                    try:
                        d_obj = _date.fromisoformat(d_str)
                    except Exception:
                        continue
                    if not market_calendar.is_business_day(d_obj):
                        non_business.append(d_str)
                if non_business:
                    placeholders = ",".join("?" * len(non_business))
                    cur = conn.execute(
                        f"DELETE FROM fx_snapshots WHERE substr(ts, 1, 10) IN ({placeholders})",
                        non_business,
                    )
                    stats["deleted_non_business_day"] = cur.rowcount or 0
            except Exception:
                logger.exception("[fx_history] cleanup non-business-day fallo")

            # 2) Fuera de [10:00, 17:00]. Usamos substr(ts,12,5) -> "HH:MM".
            cur = conn.execute(
                "DELETE FROM fx_snapshots "
                "WHERE substr(ts, 12, 5) < '10:00' OR substr(ts, 12, 5) > '17:00'"
            )
            stats["deleted_outside_wide_window"] = cur.rowcount or 0

            # 3) Hora en [10:00, 10:30): NULL MEP/CCL/canje (no es su ventana).
            cur = conn.execute(
                "UPDATE fx_snapshots SET "
                "  mep_bid=NULL, mep_last=NULL, mep_offer=NULL, "
                "  ccl_bid=NULL, ccl_last=NULL, ccl_offer=NULL, "
                "  canje_last=NULL "
                "WHERE substr(ts, 12, 5) >= '10:00' AND substr(ts, 12, 5) < '10:30'"
            )
            stats["nullified_bonos_early"] = cur.rowcount or 0

            # 4) Hora en (15:00, 17:00]: NULL spot/a3500 (fuera de su ventana).
            cur = conn.execute(
                "UPDATE fx_snapshots SET spot=NULL, a3500=NULL "
                "WHERE substr(ts, 12, 5) > '15:00' AND substr(ts, 12, 5) <= '17:00'"
            )
            stats["nullified_spot_late"] = cur.rowcount or 0

            # 5) Filas all-NULL despues de 3-4.
            cur = conn.execute(
                "DELETE FROM fx_snapshots WHERE "
                "  spot IS NULL AND a3500 IS NULL "
                "  AND mep_bid IS NULL AND mep_last IS NULL AND mep_offer IS NULL "
                "  AND ccl_bid IS NULL AND ccl_last IS NULL AND ccl_offer IS NULL "
                "  AND canje_last IS NULL"
            )
            stats["deleted_all_null"] = cur.rowcount or 0
        return stats

    # ---------- Helpers ----------
    @staticmethod
    def _tc_column(instr: str, field: str) -> str | None:
        instr_l = (instr or "").lower()
        field_l = (field or "last").lower()
        if instr_l == "canje":
            # Canje solo tiene 'last' guardado
            return "canje_last"
        if instr_l in ("mep", "ccl"):
            if field_l in ("last", "bid", "offer"):
                return f"{instr_l}_{field_l}"
        return None

    @staticmethod
    def _spot_column(leg: str) -> str | None:
        leg_l = (leg or "").lower()
        if leg_l == "spot": return "spot"
        if leg_l == "a3500": return "a3500"
        return None

    @staticmethod
    def _period_cutoff(period: str) -> str:
        now = _now()
        if period == "HOY":
            midnight = datetime(now.year, now.month, now.day)
            return midnight.isoformat()
        if period == "FULL": return "1900-01-01T00:00:00"
        if period == "5D":  return (now - timedelta(days=5)).isoformat()
        if period == "1M":  return (now - timedelta(days=30)).isoformat()
        if period == "3M":  return (now - timedelta(days=90)).isoformat()
        if period == "6M":  return (now - timedelta(days=180)).isoformat()
        if period == "1A":  return (now - timedelta(days=365)).isoformat()
        if period == "YTD":
            jan1 = datetime(now.year, 1, 1)
            return jan1.isoformat()
        # default: 1 mes
        return (now - timedelta(days=30)).isoformat()

    @staticmethod
    def _bucket_seconds(period: str) -> int:
        # Downsampling target: ~120-300 puntos por chart
        if period == "HOY": return 60              # 1 min (detalle intraday fino)
        if period == "5D":  return 60 * 30        # 30 min
        if period == "1M":  return 60 * 60 * 4    # 4 hs
        if period == "3M":  return 60 * 60 * 12   # 12 hs
        if period == "6M":  return 60 * 60 * 24   # 1 dia
        if period == "YTD": return 60 * 60 * 24
        if period == "1A":  return 60 * 60 * 24 * 2  # 2 dias
        if period == "FULL": return 60 * 60 * 24 * 7  # 1 semana (~290 puntos en ~5.5 anios)
        return 60 * 60 * 4

    def _query_bucketed(
        self,
        expr: str,
        cutoff_iso: str,
        bucket_seconds: int,
        where_extra: str | None = None,
    ) -> dict[str, Any]:
        # SQLite: convertimos ts (ISO local) a unix timestamp con strftime('%s', ts)
        # y agrupamos por intervalo. AVG(expr) por bucket. Output ordenado.
        where = f"ts >= '{cutoff_iso}'"
        if where_extra:
            where += f" AND {where_extra}"
        sql = f"""
            SELECT
                CAST((CAST(strftime('%s', ts) AS INTEGER) / {bucket_seconds}) * {bucket_seconds} AS INTEGER) AS bucket_ts,
                AVG({expr}) AS val
            FROM fx_snapshots
            WHERE {where}
            GROUP BY bucket_ts
            ORDER BY bucket_ts ASC
        """
        with closing(self._connect()) as conn:
            rows = conn.execute(sql).fetchall()
        series = []
        vals: list[float] = []
        for r in rows:
            v = r["val"]
            if v is None: continue
            ts = datetime.fromtimestamp(int(r["bucket_ts"]))
            if bucket_seconds < 3600:
                # Buckets sub-hora (HOY): solo HH:MM, todos los puntos son del dia
                label = ts.strftime("%H:%M")
            elif bucket_seconds < 86400:
                label = ts.strftime("%d/%m %H:%M")
            else:
                label = ts.strftime("%d/%m/%y")
            series.append({"label": label, "value": float(v), "ts": ts.isoformat()})
            vals.append(float(v))
        if not vals:
            return {"series": [], "min": None, "max": None, "variation": None}
        first = vals[0]
        last = vals[-1]
        variation = ((last / first) - 1) * 100 if first not in (0, None) else None
        return {
            "series": series,
            "min": min(vals),
            "max": max(vals),
            "variation": variation,
        }

    # ---------- Capture loop ----------
    def start_capture(self, market_service: Any, bcra_client: Any, ratios_resolver: Any) -> None:
        """Arranca la task asyncio que captura cada SAMPLE_SECONDS segundos.
        ratios_resolver: callable que devuelve dict items[] en el shape de /api/fx/ratios.
        """
        if self._task is not None and not self._task.done():
            return  # ya esta corriendo
        loop = asyncio.get_event_loop()
        self._stop.clear()
        self._task = loop.create_task(self._capture_loop(market_service, bcra_client, ratios_resolver))

    async def _capture_loop(self, market_service: Any, bcra_client: Any, ratios_resolver: Any) -> None:
        logger.info("[fx_history] capture loop iniciado (cada %ds)", SAMPLE_SECONDS)
        cleanup_counter = 0
        while not self._stop.is_set():
            now_ar = _now()
            # Solo capturamos en dia habil dentro de la ventana global 10-17 AR.
            # Fuera de eso dormimos largo (5 min) para no spammear.
            if not _is_business_day(now_ar) or not _in_wide_window(now_ar):
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=300)
                except asyncio.TimeoutError:
                    pass
                continue
            try:
                snap = self._build_snapshot(market_service, bcra_client, ratios_resolver, now_ar)
                if snap is not None:
                    self.insert(snap)
                cleanup_counter += 1
                if cleanup_counter >= 17280:  # ~1 dia con 5s de poll
                    cleanup_counter = 0
                    deleted = self.cleanup()
                    if deleted: logger.info("[fx_history] cleanup borro %d filas", deleted)
            except Exception:
                logger.exception("[fx_history] capture fallo")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=SAMPLE_SECONDS)
            except asyncio.TimeoutError:
                pass

    def stop(self) -> None:
        self._stop.set()

    def _build_snapshot(self, market_service: Any, bcra_client: Any, ratios_resolver: Any, when: datetime | None = None) -> FxSnapshot | None:
        try:
            now_ar = when if when is not None else _now()
            capture_spot = _in_spot_window(now_ar)
            capture_bonos = _in_bonos_window(now_ar)

            # Spot live (solo en su ventana 10-15)
            spot_val: float | None = None
            if capture_spot:
                spot_obj = market_service.spot_last() if hasattr(market_service, "spot_last") else None
                if isinstance(spot_obj, dict) and spot_obj.get("last") is not None:
                    try: spot_val = float(spot_obj["last"])
                    except (TypeError, ValueError): spot_val = None

            # A3500: BCRA series ultimo punto (misma ventana que spot)
            a3500_val: float | None = None
            if capture_spot:
                try:
                    a35 = bcra_client.get_series("usd_mayorista_a3500")
                    pts = (a35 or {}).get("data") or []
                    if pts:
                        last_pt = pts[-1]
                        v = last_pt.get("value") if isinstance(last_pt, dict) else None
                        if v is not None:
                            a3500_val = float(v)
                except Exception:
                    pass

            # MEP / CCL / canje via ratios_resolver (solo en 10:30-17)
            mep_bid = mep_last = mep_offer = None
            ccl_bid = ccl_last = ccl_offer = None
            canje_last: float | None = None
            if capture_bonos:
                ratios = ratios_resolver() if callable(ratios_resolver) else {"items": []}
                items = (ratios or {}).get("items") or []
                mep = next((it for it in items if str(it.get("label", "")).upper() == "MEP"), None)
                ccl = next((it for it in items if str(it.get("label", "")).upper() == "CCL"), None)

                def _f(d: dict | None, k: str) -> float | None:
                    if not d: return None
                    v = d.get(k)
                    if v is None: return None
                    try: return float(v)
                    except (TypeError, ValueError): return None

                mep_bid   = _f(mep, "ratio_bid")
                mep_last  = _f(mep, "ratio")
                mep_offer = _f(mep, "ratio_offer")
                ccl_bid   = _f(ccl, "ratio_bid")
                ccl_last  = _f(ccl, "ratio")
                ccl_offer = _f(ccl, "ratio_offer")

                if mep_last is not None and ccl_last is not None and mep_last != 0:
                    canje_last = ((ccl_last / mep_last) - 1) * 100

            ts = now_ar.isoformat()
            return FxSnapshot(
                ts=ts, spot=spot_val, a3500=a3500_val,
                mep_bid=mep_bid, mep_last=mep_last, mep_offer=mep_offer,
                ccl_bid=ccl_bid, ccl_last=ccl_last, ccl_offer=ccl_offer,
                canje_last=canje_last,
            )
        except Exception:
            logger.exception("[fx_history] _build_snapshot fallo")
            return None
