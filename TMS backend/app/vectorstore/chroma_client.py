import chromadb
import requests


from app.config import CHROMA_DB_PATH

OLLAMA_URL = "http://localhost:11434/api/embed"
EMBEDDING_MODEL = "nomic-embed-text"


class ChromaService:

    def __init__(self):

        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

        self.collection = self.client.get_or_create_collection(
            name="TMS_schema"
        )

        self.cache_collection = self.client.get_or_create_collection(
            name="TMS_query_cache",
            metadata={
                "hnsw:space": "cosine"
            }
        )

        self.file_schema_collection = self.client.get_or_create_collection(
            name="file_schema"
        )

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

    def add_file_document(
        self,
        id: str,
        text: str,
        dataset_id: str
    ):

        embedding = self.get_embedding(text)

        self.file_schema_collection.upsert(

            ids=[id],

            documents=[text],

            embeddings=[embedding],

            metadatas=[

                {
                    "dataset_id": dataset_id
                }

            ]

        )

    def clear_file_schema(self):

        print("[File RAG] Clearing previous uploaded file schema...")

        data = self.file_schema_collection.get(include=[])

        ids = data.get("ids", [])

        if ids:
            self.file_schema_collection.delete(ids=ids)

        print(f"[File RAG] Deleted {len(ids)} schema documents.")

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
    
    def retrieve_file_schema(
        self,
        dataset_id: str,
        question: str,
        k: int = 5
    ):

        embedding = self.get_embedding(question)

        results = self.file_schema_collection.query(

            query_embeddings=[embedding],

            n_results=k,

            where={
                "dataset_id": dataset_id
            }

        )

        return "\n\n".join(
            results["documents"][0]
        )