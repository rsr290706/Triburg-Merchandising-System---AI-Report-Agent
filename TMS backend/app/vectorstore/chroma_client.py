import chromadb
from openai import OpenAI
import os


class ChromaService:

    def __init__(self):

        self.client = chromadb.PersistentClient(path="./chroma_db")

        self.collection = self.client.get_or_create_collection(
            name="tms_schema"
        )

        self.openai = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY")
        )

    def get_embedding(self, text: str):

        response = self.openai.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )

        return response.data[0].embedding

    def add_document(self, id: str, text: str):

        embedding = self.get_embedding(text)

        self.collection.add(
            ids=[id],
            documents=[text],
            embeddings=[embedding]
        )

    def search(self, question: str, top_k: int = 5):

        embedding = self.get_embedding(question)

        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k
        )

        return results["documents"][0]