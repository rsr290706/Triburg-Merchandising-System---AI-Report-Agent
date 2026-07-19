from __future__ import annotations
from app.metadata.column_profiles import COLUMN_PROFILES
try:
    from rapidfuzz import fuzz

    _HAS_RAPIDFUZZ = True
except ImportError:  
    _HAS_RAPIDFUZZ = False


_KEYWORD_RULES: list[tuple[str, str]] = [
    ("date", "Date"),
    ("dt", "Date"),
    ("qty", "Quantity"),
    ("quantity", "Quantity"),
    ("units", "Quantity"),
    ("value", "Currency"),
    ("amount", "Currency"),
    ("price", "Currency"),
    ("cost", "Currency"),
    ("revenue", "Currency"),
    ("status", "Status"),
    ("country", "Location"),
    ("region", "Location"),
    ("city", "Location"),
    ("buyer", "Business Entity"),
    ("merchant", "Business Entity"),
    ("vendor", "Business Entity"),
    ("factory", "Business Entity"),
    ("customer", "Business Entity"),
    ("email", "Contact"),
    ("phone", "Contact"),
    ("no", "Identifier"),
    ("id", "Identifier"),
    ("code", "Identifier"),
]


_ALIAS_LOOKUP: dict[str, str] = {
    "qty": "Quantity",
    "quantity": "Quantity",
    "units": "Quantity",
    "pieces": "Quantity",
    "count": "Quantity",
    "shipped": "Quantity",

    "value": "Currency",
    "amount": "Currency",
    "price": "Currency",
    "cost": "Currency",
    "revenue": "Currency",
    "worth": "Currency",

    "date": "Date",
    "dt": "Date",
    "timestamp": "Date",
    "time": "Date",
    "day": "Date",

    "status": "Status",
    "state": "Status",
    "result": "Status",
    "outcome": "Status",

    "vendor": "Business Entity",
    "merchant": "Business Entity",
    "buyer": "Business Entity",
    "factory": "Business Entity",
    "supplier": "Business Entity",

    "country": "Location",
    "region": "Location",
    "city": "Location",
    "location": "Location",
}

_KEYWORD_CONFIDENCE = 0.9
_FUZZY_MATCH_THRESHOLD = 0.85


def detect_semantic_type(column_name: str) -> tuple[str, float]:
    
    normalized = column_name.strip().lower().replace("_", " ").replace("-", " ")
    tokens = normalized.split()
    for keyword, semantic_type in _KEYWORD_RULES:

        if keyword == normalized:
            return semantic_type, _KEYWORD_CONFIDENCE

        if keyword in tokens:
            return semantic_type, _KEYWORD_CONFIDENCE

        if normalized.startswith(keyword):
            return semantic_type, _KEYWORD_CONFIDENCE

        if normalized.endswith(keyword):
            return semantic_type, _KEYWORD_CONFIDENCE

    if _HAS_RAPIDFUZZ:
        best_type: str | None = None
        best_score = 0.0

        for alias, semantic_type in _ALIAS_LOOKUP.items():

            score = fuzz.token_set_ratio(
                normalized,
                alias,
            ) / 100

            if score > best_score:
                best_score = score
                best_type = semantic_type

        if best_type and best_score >= _FUZZY_MATCH_THRESHOLD:
            return best_type, round(best_score, 2)

    return "Unknown", 0.3


def match_known_profile(column_name: str, profiles: dict[str, dict]) -> tuple[str | None, float]:
    if not _HAS_RAPIDFUZZ or not profiles:
        return None, 0.0

    normalized = column_name.strip().lower().replace("_", " ").replace("-", " ")

    best_key: str | None = None
    best_score = 0.0
    for key, profile in profiles.items():
        candidates = {
            key.replace("_", " ").lower(),
            *(
                alias.lower()
                for alias in profile.get("aliases", [])
            ),
        }
        for candidate in candidates:

            score = fuzz.token_set_ratio(
                normalized,
                candidate,
            ) / 100

            if score > best_score:
                best_score = score
                best_key = key

    if best_score >= _FUZZY_MATCH_THRESHOLD:
        return best_key, round(best_score, 2)
    return None, 0.0


def build_fallback_profile(column_name: str) -> dict:
  
    semantic_type, confidence = detect_semantic_type(column_name)
    return {
        "meaning": "Business data column." if semantic_type == "Unknown" else f"Inferred {semantic_type.lower()} column.",
        "semantic_type": semantic_type,
        "description": "",
        "aliases": [],
        "sql_usage": [],
        "business_rules": [],
        "related_columns": [],
        "common_queries": [],
        "confidence": confidence,
        "inferred": True,
    }

def build_query_expansion(
    question: str,
    profiles: dict[str, dict],
) -> str:

    expanded = question
    lower_question = question.lower()

    for profile_name, profile in profiles.items():

        aliases = profile.get("aliases", [])

        if any(alias.lower() in lower_question for alias in aliases):

            expanded += " " + profile_name

            expanded += " " + " ".join(aliases)

    return expanded
