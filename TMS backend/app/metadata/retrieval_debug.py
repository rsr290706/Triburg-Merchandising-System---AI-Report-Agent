from __future__ import annotations

from typing import Any


def log_retrieval(query_results: dict[str, Any], label: str = "Retrieved") -> None:
    
    ids = (query_results.get("ids") or [[]])[0]
    distances = (query_results.get("distances") or [[]])[0]

    if not ids:
        print(f"{label}: (no results)")
        return

    print(f"{label}:")
    for doc_id, distance in zip(ids, distances):
        print(f"  {doc_id:<20} distance={distance:.4f}")
