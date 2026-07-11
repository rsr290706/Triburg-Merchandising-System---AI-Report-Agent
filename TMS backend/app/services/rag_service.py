from app.vectorstore.chroma_client import ChromaService


class RAGService:

    def __init__(self):

        self.vector_db = ChromaService()

    def retrieve_schema(self, question: str):

        documents = self.vector_db.search(
            question=question,
            top_k=5
        )

        schema = "\n\n".join(documents)

        return schema