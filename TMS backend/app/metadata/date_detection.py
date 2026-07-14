"""Multi-format date column detection (item #7).

The original implementation only tried a single dayfirst=True parse.
This tries several common layouts and keeps whichever parses the
highest share of sample values, so columns like "2022/04/02",
"04-02-2022", or native pandas Timestamps are all picked up.
"""

from __future__ import annotations

import warnings

import pandas as pd

# Tried in order; the first format that clears the success threshold
# on the sample wins. dayfirst variants are tried both ways since
# "02-04-2022" is ambiguous without extra context.
_CANDIDATE_FORMATS: list[dict] = [
    {"dayfirst": True},
    {"dayfirst": False},
    {"format": "%Y-%m-%d"},
    {"format": "%Y/%m/%d"},
    {"format": "%m/%d/%Y"},
    {"format": "%d/%m/%Y"},
    {"format": "%d-%m-%Y"},
    {"format": "%m-%d-%Y"},
]

_SUCCESS_THRESHOLD = 0.8
_SAMPLE_SIZE = 100


def is_textlike(series: pd.Series) -> bool:
    """True for columns that could plausibly hold date/numeric strings.

    Checks both classic `object` dtype and pandas' newer dedicated
    string dtype (default for text columns as of pandas 2.x/3.x with
    `future.infer_string`, or via `dtype="str"`). Relying on
    `is_object_dtype` alone silently skips these columns entirely on
    newer pandas versions - they're never even considered for date or
    numeric conversion.
    """
    return pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)


def detect_date_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Convert columns that look like dates into real datetime dtype.

    Mutates and returns the same DataFrame for convenience, matching
    the calling convention of the original `_detect_date_columns`.
    """
    for column in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[column]):
            continue

        if not is_textlike(df[column]):
            continue

        sample = df[column].dropna().head(_SAMPLE_SIZE)
        if sample.empty:
            continue

        best_kwargs = None
        best_rate = 0.0

        with warnings.catch_warnings():
            # Explicit-format candidates are exact; the two dayfirst
            # candidates intentionally let pandas infer per-value, which
            # emits a harmless "falling back to dateutil" warning on
            # mixed/ambiguous samples - expected here, not a bug.
            warnings.filterwarnings("ignore", message="Could not infer format")
            for kwargs in _CANDIDATE_FORMATS:
                converted = pd.to_datetime(sample, errors="coerce", **kwargs)
                success_rate = converted.notna().mean()
                if success_rate > best_rate:
                    best_rate = success_rate
                    best_kwargs = kwargs
                if best_rate >= 0.999:
                    break

            if best_kwargs is not None and best_rate >= _SUCCESS_THRESHOLD:
                df[column] = pd.to_datetime(df[column], errors="coerce", **best_kwargs)
                print(f"[DATE DETECTED] {column} (format={best_kwargs}, match_rate={best_rate:.0%})")

    return df
