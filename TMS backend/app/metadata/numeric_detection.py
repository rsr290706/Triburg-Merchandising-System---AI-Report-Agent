"""Detects numeric columns that were read in as text because of
formatting like thousands separators ("6,990") or currency symbols.

Without this, a column like Insp_Qty in the sample TMS export stays
string-typed forever, which quietly breaks item #9's numeric
statistics (min/max/mean/etc.) and mis-tags the column's semantic
type. Runs after date detection so genuine date strings are never
mistaken for numbers.
"""

from __future__ import annotations

import re

import pandas as pd

from app.metadata.date_detection import is_textlike

_SUCCESS_THRESHOLD = 0.8
_SAMPLE_SIZE = 100
_STRIP_PATTERN = re.compile(r"[,$€£\s]")

# Columns whose name reads as an identifier (PO_No, Style_Code, ...)
# are skipped even if every value happens to be digits: converting an
# identifier to float64 risks losing leading zeros / exact precision,
# and it isn't meant to be summed or averaged anyway.
_IDENTIFIER_TOKENS = {"id", "no", "code", "number"}


def _looks_like_identifier(column_name: str) -> bool:
    tokens = re.split(r"[_\s]+", column_name.strip().lower())
    return any(token in _IDENTIFIER_TOKENS for token in tokens)


def _clean(value):
    if isinstance(value, str):
        return _STRIP_PATTERN.sub("", value)
    return value


def detect_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Convert text columns holding formatted numbers into numeric dtype.

    Mutates and returns the same DataFrame for convenience, matching
    the calling convention of `detect_date_columns`.
    """
    for column in df.columns:
        if pd.api.types.is_numeric_dtype(df[column]):
            continue
        if pd.api.types.is_datetime64_any_dtype(df[column]):
            continue
        if not is_textlike(df[column]):
            continue
        if _looks_like_identifier(column):
            continue

        sample = df[column].dropna().head(_SAMPLE_SIZE)
        if sample.empty:
            continue

        converted_sample = pd.to_numeric(sample.map(_clean), errors="coerce")
        success_rate = converted_sample.notna().mean()

        if success_rate >= _SUCCESS_THRESHOLD:
            df[column] = pd.to_numeric(df[column].map(_clean), errors="coerce")
            print(f"[NUMERIC DETECTED] {column} (match_rate={success_rate:.0%})")

    return df
