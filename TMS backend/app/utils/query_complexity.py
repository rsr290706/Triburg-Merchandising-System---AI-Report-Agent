import re

SIMPLE_KEYWORDS = {
    "show", "list", "display", "find", "get", "fetch",
    "count", "distinct", "unique", "search", "lookup",
}

ADVANCED_KEYWORDS = {
    "top", "bottom", "highest", "lowest", "largest", "smallest",
    "greatest", "least", "most", "fewest", "biggest", "maximum", "minimum",
    "max", "min",
    "average", "avg", "sum", "total", "mean", "median",
    "variance", "stddev", "standard deviation",
    "trend", "running", "cumulative", "rolling", "rank", "dense_rank",
    "row_number", "partition", "window", "moving average",
    "over time", "over the",
    "percent", "percentage", "ratio", "proportion", "share of",
    "per", "for each", "each", "grouped by", "group by",
    "broken down by", "split by", "by region", "by category",
    "compare", "comparison", "versus", "vs", "difference between",
    "above average", "below average", "outlier",
    "last month", "last quarter", "last year", "today", "yesterday",
    "ytd", "year over year", "month over month", "week over week",
    "yoy", "mom", "wow", "quarter over quarter", "qoq",
    "join", "combined", "overall", "in total", "on average",
}

_SMALL_NUMBER_WORDS = (
    "one|two|three|four|five|six|seven|eight|nine|ten"
)
_NUMERIC_RANK_RE = re.compile(
    rf"\b(top|bottom|first|last)\s*(\d+|{_SMALL_NUMBER_WORDS})\b"
)
_WHITESPACE_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[^\w\s%]")

_pattern_cache: dict[str, re.Pattern] = {}


def _keyword_pattern(keyword: str) -> re.Pattern:
    pattern = _pattern_cache.get(keyword)
    if pattern is None:
        escaped = re.escape(keyword).replace(r"\ ", r"\s+")
        pattern = re.compile(rf"\b{escaped}\b")
        _pattern_cache[keyword] = pattern
    return pattern


def _contains_any(text: str, keywords: set[str]) -> bool:
    return any(_keyword_pattern(k).search(text) for k in keywords)


def _normalize(question: str) -> str:
    q = question.lower()
    q = _PUNCT_RE.sub(" ", q)
    q = _WHITESPACE_RE.sub(" ", q).strip()
    return q


def is_simple_query(question: str) -> bool:
    q = _normalize(question)

    if _NUMERIC_RANK_RE.search(q):
        return False

    if _contains_any(q, ADVANCED_KEYWORDS):
        return False

    return True
