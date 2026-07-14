from app.vectorstore.chroma_client import ChromaService

class FileRAGService:

    def __init__(self):

        self.chroma = ChromaService()

    def retrieve_schema(
        self,
        dataset_id: str,
        question: str
    ):

        print("=" * 60)
        print("[File RAG] Retrieving Schema")
        print("Question:", question)

        schema = self.chroma.retrieve_file_schema(
            dataset_id,
            question
        )

        print("\nRetrieved Schema:\n")
        print(schema)
        print("=" * 60)

        return schema
    