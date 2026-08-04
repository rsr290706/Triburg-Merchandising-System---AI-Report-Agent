import re

YEAR_RE = re.compile(r"\b20\d{2}\b")
NUMBER_RE = re.compile(r"\b\d+\b")


def extract_literals(text: str) -> dict:
    text = text.lower()

    return {
        "years": sorted(YEAR_RE.findall(text)),
        "numbers": sorted(NUMBER_RE.findall(text)),
    }


def cache_safe(cached_question: str, incoming_question: str) -> bool:
    return extract_literals(cached_question) == extract_literals(incoming_question)