from __future__ import annotations
import re
from typing import Any


class RetrievalRanker:

    EMBEDDING_WEIGHT = 0.4
    KEYWORD_WEIGHT = 0.6

    @staticmethod
    def _tokenize(text: str) -> set[str]:

        words = re.findall(
            r"[a-z0-9]+",
            text.lower(),
        )

        normalized = set()

        for word in words:

            if word.endswith("s") and len(word) > 3:
                word = word[:-1]

            normalized.add(word)

        return normalized

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

    @classmethod
    def rerank(cls, question, results):
    
        if not results:
            return []
    
        distances = [r["distance"] for r in results]

        min_distance = min(distances)
        max_distance = max(distances)

        for result in results:

            if max_distance == min_distance:

                embedding_score = 1.0

            else:

                embedding_score = (
                    max_distance - result["distance"]
                ) / (
                    max_distance - min_distance
                )

            keyword_score = cls.keyword_overlap(
                question,
                result["text"],
            )

            result["embedding_score"] = embedding_score
            result["keyword_score"] = keyword_score

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