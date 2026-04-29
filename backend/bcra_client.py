from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import requests

from backend.config import Settings
from backend.time_utils import now_argentina


MAX_LIMIT = 3000


@dataclass(frozen=True)
class BcraSeriesDefinition:
    key: str
    variable_id: int
    label: str
    unit: str


BCRA_SERIES: dict[str, BcraSeriesDefinition] = {
    "cer": BcraSeriesDefinition(
        key="cer",
        variable_id=30,
        label="CER (Base 2.2.2002=1)",
        unit="Indice base 2.2.02=1",
    ),
    "tamar_private_banks_na": BcraSeriesDefinition(
        key="tamar_private_banks_na",
        variable_id=44,
        label="TAMAR en pesos de bancos privados (en % n.a.)",
        unit="Porcentaje nominal anual",
    ),
}


class BcraClient:
    def __init__(self, settings: Settings) -> None:
        self.base_url = settings.bcra_base_url.rstrip("/")
        self.cache_ttl = timedelta(seconds=settings.bcra_cache_ttl_seconds)
        self._cache: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    def get_series(
        self,
        key: str,
        desde: date | None = None,
        hasta: date | None = None,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        definition = self._definition(key)
        cache_key = self._cache_key(key, desde, hasta)

        with self._lock:
            cached = self._cache.get(cache_key)
            if cached and not force_refresh and self._is_fresh(cached):
                return cached["payload"]

        points = self._fetch_all_points(definition.variable_id, desde, hasta)
        payload = {
            "key": definition.key,
            "id_variable": definition.variable_id,
            "label": definition.label,
            "unit": definition.unit,
            "source": "BCRA Estadisticas Monetarias v4",
            "updated_at": now_argentina().isoformat(timespec="seconds"),
            "count": len(points),
            "latest": points[-1] if points else None,
            "data": points,
        }

        with self._lock:
            self._cache[cache_key] = {"fetched_at": now_argentina(), "payload": payload}

        return payload

    def get_all_series(
        self,
        desde: date | None = None,
        hasta: date | None = None,
        force_refresh: bool = False,
        limit: int | None = None,
    ) -> dict[str, Any]:
        series = [
            self._apply_limit(self.get_series(key, desde, hasta, force_refresh), limit)
            for key in BCRA_SERIES
        ]
        return {
            "updated_at": now_argentina().isoformat(timespec="seconds"),
            "series": series,
        }

    def refresh_all(self) -> dict[str, Any]:
        return self.get_all_series(force_refresh=True)

    def _fetch_all_points(
        self,
        variable_id: int,
        desde: date | None = None,
        hasta: date | None = None,
    ) -> list[dict[str, Any]]:
        points: list[dict[str, Any]] = []
        offset = 0

        while True:
            payload = self._fetch_page(variable_id, desde, hasta, offset)
            detail = payload.get("results", [{}])[0].get("detalle", [])
            points.extend(self._normalize_points(detail))

            resultset = payload.get("metadata", {}).get("resultset", {})
            count = int(resultset.get("count") or len(points))
            offset += MAX_LIMIT
            if offset >= count or not detail:
                break

        return sorted(points, key=lambda item: item["date"])

    def _fetch_page(
        self,
        variable_id: int,
        desde: date | None,
        hasta: date | None,
        offset: int,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"Limit": MAX_LIMIT, "Offset": offset}
        if desde:
            params["Desde"] = desde.isoformat()
        if hasta:
            params["Hasta"] = hasta.isoformat()

        response = requests.get(
            f"{self.base_url}/estadisticas/v4.0/Monetarias/{variable_id}",
            params=params,
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _normalize_points(detail: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "date": item["fecha"],
                "value": item["valor"],
            }
            for item in detail
            if item.get("fecha") is not None and item.get("valor") is not None
        ]

    @staticmethod
    def _apply_limit(payload: dict[str, Any], limit: int | None) -> dict[str, Any]:
        if limit is None or limit <= 0:
            return payload

        data = payload["data"][-limit:]
        return {
            **payload,
            "returned_count": len(data),
            "data": data,
        }

    @staticmethod
    def _definition(key: str) -> BcraSeriesDefinition:
        try:
            return BCRA_SERIES[key]
        except KeyError as exc:
            raise ValueError(f"Unknown BCRA series: {key}") from exc

    def _is_fresh(self, cached: dict[str, Any]) -> bool:
        return now_argentina() - cached["fetched_at"] < self.cache_ttl

    @staticmethod
    def _cache_key(key: str, desde: date | None, hasta: date | None) -> str:
        return f"{key}:{desde.isoformat() if desde else ''}:{hasta.isoformat() if hasta else ''}"
