"""Per-column statistics used to enrich schema documents (item #9).

Kept separate from ImportedFileService so it can be unit tested and
reused (e.g. by an export or profiling endpoint) without touching the
upload/ingestion flow.
"""

from __future__ import annotations

from typing import Any

import pandas as pd


def _safe_round(value: Any, ndigits: int = 2) -> Any:
    if value is None or pd.isna(value):
        return None
    try:
        return round(float(value), ndigits)
    except (TypeError, ValueError):
        return value


def compute_column_statistics(series: pd.Series, datatype: str) -> dict[str, Any]:
    """Return a dict of statistics appropriate to the column's datatype.

    - Numeric: min / max / mean / median / std / p25 / p75 / p95
    - Date: earliest / latest / range_days
    - Text: shortest / longest length + top 5 most common values
    """
    non_null = series.dropna()
    if non_null.empty:
        return {}

    if datatype == "Numeric":
        return {
            "min": _safe_round(non_null.min()),
            "max": _safe_round(non_null.max()),
            "mean": _safe_round(non_null.mean()),
            "median": _safe_round(non_null.median()),
            "std": _safe_round(non_null.std()),
            "p25": _safe_round(non_null.quantile(0.25)),
            "p75": _safe_round(non_null.quantile(0.75)),
            "p95": _safe_round(non_null.quantile(0.95)),
        }

    if datatype == "Date":
        earliest = non_null.min()
        latest = non_null.max()
        range_days = None
        try:
            range_days = int((latest - earliest).days)
        except (TypeError, AttributeError):
            pass
        return {
            "earliest": str(earliest.date()) if hasattr(earliest, "date") else str(earliest),
            "latest": str(latest.date()) if hasattr(latest, "date") else str(latest),
            "range_days": range_days,
        }

    # Text / categorical
    as_text = non_null.astype(str)
    lengths = as_text.str.len()
    top_values = as_text.value_counts().head(5)
    return {
        "shortest": int(lengths.min()),
        "longest": int(lengths.max()),
        "top_values": [{"value": value, "count": int(count)} for value, count in top_values.items()],
    }


def format_statistics(stats: dict[str, Any]) -> str:
    """Render a statistics dict as compact, LLM-friendly text lines."""
    if not stats:
        return ""

    lines = []
    for key, value in stats.items():
        if key == "top_values":
            rendered = ", ".join(f"{item['value']} ({item['count']})" for item in value)
            lines.append(f"Top values: {rendered}")
        elif value is not None:
            label = key.replace("_", " ").capitalize()
            lines.append(f"{label}: {value}")
    return "\n".join(lines)
