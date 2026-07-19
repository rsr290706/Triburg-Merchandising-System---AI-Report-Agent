from app.vectorstore.chroma_client import ChromaService
from app.metadata.semantic_detection import build_query_expansion
from app.metadata.column_profiles import COLUMN_PROFILES
from app.services.retrieval_ranker import RetrievalRanker

class RAGService:

    def __init__(self):

        self.vector_db = ChromaService()
        self.ranker = RetrievalRanker()

    def retrieve_schema(self, question: str):

        expanded_question = build_query_expansion(
            question,
            COLUMN_PROFILES,
        )

        top_k = self.determine_top_k(
            expanded_question
        )

        results = self.vector_db.search(
            question=expanded_question,
            top_k=top_k,
        )
        results = self.ranker.rerank(
            question,
            results,
        )

        context = self.vector_db.build_context(results)

        return {
            "context": context,
            "results": results,
        }
    
    def determine_top_k(
        self,
        question: str,
    ) -> int:

        question = question.lower()

        aggregation = [
            "total",
            "sum",
            "average",
            "count",
            "maximum",
            "minimum",
        ]

        join_words = [
            "buyer",
            "merchant",
            "factory",
            "country",
            "team",
            "style",
        ]

        if any(word in question for word in aggregation):

            return 12

        if any(word in question for word in join_words):

            return 10

        return 6