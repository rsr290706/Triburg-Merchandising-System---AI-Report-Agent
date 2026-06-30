import chromadb
import requests
import chromadb

from app.config import CHROMA_DB_PATH

OLLAMA_URL = "http://localhost:11434/api/embed"
EMBEDDING_MODEL = "nomic-embed-text"


class ChromaService:

    def __init__(self):

        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

        self.collection = self.client.get_or_create_collection(
            name="TMS_schema"
        )

        print("=" * 60)
        print("Collection:", self.collection.name)
        print("Document Count:", self.collection.count())
        print("=" * 60)

    def get_embedding(self, text: str):

        response = requests.post(
            OLLAMA_URL,
            json={
                "model": EMBEDDING_MODEL,
                "input": text
            },
            timeout=60
        )

        response.raise_for_status()

        return response.json()["embeddings"][0]

    def add_document(self, id: str, text: str):

        embedding = self.get_embedding(text)

        self.collection.upsert(
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

        documents = results.get("documents", [[]])

        if not documents or not documents[0]:
            return []

        return documents[0]