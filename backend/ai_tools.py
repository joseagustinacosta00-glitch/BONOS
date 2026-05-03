from __future__ import annotations

import math
from statistics import mean
from typing import Any


def normalize_ai_ticker(ticker: str) -> str:
    value = str(ticker or "").upper().strip()
    if len(value) > 1 and value[-1] in {"D", "C"} and any(char.isdigit() for char in value[:-1]):
        return value[:-1]
    return value


def calculate_spread_points(series_a: list[dict[str, Any]], series_b: list[dict[str, Any]]) -> list[dict[str, float | str]]:
    by_date_b = {_point_date(point): _point_value(point) for point in series_b}
    points = []
    for point in series_a:
        date = _point_date(point)
        value_a = _point_value(point)
        value_b = by_date_b.get(date)
        if date and value_a is not None and value_b is not None:
            points.append({"date": date, "value": value_a - value_b, "value_a": value_a, "value_b": value_b})
    return sorted(points, key=lambda item: str(item["date"]))


def calculate_ratio_points(series_a: list[dict[str, Any]], series_b: list[dict[str, Any]]) -> list[dict[str, float | str]]:
    by_date_b = {_point_date(point): _point_value(point) for point in series_b}
    points = []
    for point in series_a:
        date = _point_date(point)
        value_a = _point_value(point)
        value_b = by_date_b.get(date)
        if date and value_a is not None and value_b not in (None, 0):
            points.append({"date": date, "value": value_a / value_b, "value_a": value_a, "value_b": value_b})
    return sorted(points, key=lambda item: str(item["date"]))


def calculate_rolling_zscore(points: list[dict[str, Any]], window: int = 20) -> list[dict[str, float | str | None]]:
    clean_points = [
        {"date": _point_date(point), "value": _point_value(point)}
        for point in sorted(points, key=lambda item: str(_point_date(item)))
    ]
    window = max(int(window or 20), 2)
    result = []
    values: list[float] = []
    for point in clean_points:
        date = point["date"]
        value = point["value"]
        if not date or value is None:
            continue
        values.append(value)
        if len(values) < window:
            result.append({"date": date, "value": value, "zscore": None, "rolling_mean": None, "rolling_std": None})
            continue
        sample = values[-window:]
        rolling_mean = mean(sample)
        variance = sum((item - rolling_mean) ** 2 for item in sample) / len(sample)
        rolling_std = math.sqrt(variance)
        zscore = None if rolling_std == 0 else (value - rolling_mean) / rolling_std
        result.append(
            {
                "date": date,
                "value": value,
                "zscore": zscore,
                "rolling_mean": rolling_mean,
                "rolling_std": rolling_std,
            }
        )
    return result


def summarize_series(points: list[dict[str, Any]]) -> dict[str, float | int | str | None]:
    clean_points = [
        {"date": _point_date(point), "value": _point_value(point)}
        for point in sorted(points, key=lambda item: str(_point_date(item)))
        if _point_date(point) and _point_value(point) is not None
    ]
    if not clean_points:
        return {"points_count": 0, "first_date": None, "last_date": None, "last_value": None}
    last = clean_points[-1]
    return {
        "points_count": len(clean_points),
        "first_date": clean_points[0]["date"],
        "last_date": last["date"],
        "last_value": last["value"],
    }


def build_basic_study_summary(
    series_a: dict[str, Any],
    series_b: dict[str, Any],
    points: list[dict[str, Any]],
    zscore_points: list[dict[str, Any]],
    window: int = 20,
    mode: str = "spread",
) -> dict[str, Any]:
    latest = next((point for point in reversed(zscore_points) if point.get("zscore") is not None), None)
    warnings = []
    if not points:
        warnings.append("No hay fechas en comun entre las dos series.")
    elif len(points) < window:
        warnings.append("Hay menos puntos que la ventana seleccionada; el z-score puede no estar disponible.")
    reading = "Sin lectura preliminar por falta de datos suficientes."
    if latest and latest.get("zscore") is not None:
        zscore = float(latest["zscore"])
        if zscore >= 2:
            reading = "El valor actual esta muy por encima de su media rolling."
        elif zscore >= 1:
            reading = "El valor actual esta por encima de su media rolling."
        elif zscore <= -2:
            reading = "El valor actual esta muy por debajo de su media rolling."
        elif zscore <= -1:
            reading = "El valor actual esta por debajo de su media rolling."
        else:
            reading = "El valor actual esta cerca de su media rolling."
    return {
        "mode": mode,
        "window": window,
        "series_a": series_a,
        "series_b": series_b,
        "points_summary": summarize_series(points),
        "latest": latest,
        "reading": reading,
        "warnings": warnings,
        "points": points,
        "zscore_points": zscore_points,
    }


def _point_date(point: dict[str, Any]) -> str:
    return str(point.get("date") or point.get("value_date") or "").strip()


def _point_value(point: dict[str, Any]) -> float | None:
    try:
        value = point.get("value")
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
