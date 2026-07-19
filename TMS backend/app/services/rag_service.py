from app.vectorstore.chroma_client import ChromaService
from app.metadata.semantic_detection import build_query_expansion
from app.metadata.column_profiles import COLUMN_PROFILES
from app.services.retrieval_ranker import RetrievalRanker
from app.prompts.sql_prompts import is_simple_query

class RAGService:

    def __init__(self):

        self.vector_db = ChromaService()
        self.ranker = RetrievalRanker()

    def retrieve_schema(self, question: str):

        expanded_question = build_query_expansion(
            question,
            COLUMN_PROFILES,
        )

        top_k = self.determine_top_k(question)

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

        if is_simple_query(question):
            return 6

        return 15