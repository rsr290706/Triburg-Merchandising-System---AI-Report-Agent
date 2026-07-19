from __future__ import annotations

from collections import Counter
from typing import Any


class RetrievalRanker:

    EMBEDDING_WEIGHT = 0.7
    KEYWORD_WEIGHT = 0.3

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        return {
            token.lower()
            for token in text.replace("_", " ").split()
            if token.strip()
        }

    @classmethod
    def keyword_overlap(
        cls,
        question: str,
        document: str,
    ) -> float:

        q = cls._tokenize(question)
        d = cls._tokenize(document)

        if not q or not d:
            return 0.0

        overlap = len(q & d)

        return overlap / len(q)

    @staticmethod
    def normalize_distance(distance: float) -> float:

        similarity = 1 - distance

        return max(0.0, min(1.0, similarity))

    @classmethod
    def rerank(
        cls,
        question: str,
        results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:

        for result in results:

            embedding_score = cls.normalize_distance(
                result["distance"]
            )

            keyword_score = cls.keyword_overlap(
                question,
                result["text"],
            )

            result["retrieval_score"] = (
                cls.EMBEDDING_WEIGHT * embedding_score
                +
                cls.KEYWORD_WEIGHT * keyword_score
            )

        return sorted(
            results,
            key=lambda r: r["retrieval_score"],
            reverse=True,
        )