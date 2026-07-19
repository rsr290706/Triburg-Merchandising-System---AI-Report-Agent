import chromadb
import requests


from app.config import CHROMA_DB_PATH , OLLAMA_URL

OLLAMA_URL = OLLAMA_URL + "/embed"
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

    def get_embedding(self, text):

        response = requests.post(

            OLLAMA_URL,

            json={

                "model": EMBEDDING_MODEL,

                "input": text

            },

            timeout=60

        )

        response.raise_for_status()

        embeddings = response.json()["embeddings"]

        if isinstance(text, str):

            return embeddings[0]

        return embeddings
    
    def add_file_documents(
        self,
        documents,
        dataset_id,
        metadatas=None
    ):

        texts = [
            doc["text"]
            for doc in documents
        ]

        embeddings = self.get_embedding(texts)

        ids = [
            f"{dataset_id}-{doc['id']}"
            for doc in documents
        ]

        #
        # If caller didn't provide metadata,
        # fall back to the old behaviour.
        #
        if metadatas is None:

            metadatas = [

                {
                    "dataset_id": dataset_id
                }

                for _ in documents

            ]

        #
        # Otherwise merge dataset_id with
        # each document's metadata.
        #
        else:

            metadatas = [

                {
                    "dataset_id": dataset_id,
                    **metadata
                }

                for metadata in metadatas

            ]

        self.file_schema_collection.upsert(

            ids=ids,

            documents=texts,

            embeddings=embeddings,

            metadatas=metadatas

        )

    def add_document(
        self,
        id: str,
        text: str,
        metadata: dict | None = None,
    ):

        embedding = self.get_embedding(text)

        self.collection.upsert(
            ids=[id],
            documents=[text],
            embeddings=[embedding],
            metadatas=[metadata or {}],
        )

    def add_documents(self, documents: list[dict]):

        texts = [doc["text"] for doc in documents]

        ids = [doc["id"] for doc in documents]

        metadatas = [
            doc.get("metadata", {})
            for doc in documents
        ]

        embeddings = self.get_embedding(texts)

        self.collection.upsert(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    def clear_schema(self):

        data = self.collection.get(include=[])

        ids = data.get("ids", [])

        if ids:
            self.collection.delete(ids=ids)

        print(f"Deleted {len(ids)} schema documents.")

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

    def _format_results(self, results):

        documents = results.get("documents", [[]])[0]

        metadatas = results.get("metadatas", [[]])[0]

        distances = results.get("distances", [[]])[0]

        ids = results.get("ids", [[]])[0]

        retrieved = []

        for id_, text, metadata, distance in zip(

            ids,

            documents,

            metadatas,

            distances,

        ):

            retrieved.append(

                {

                    "id": id_,

                    "text": text,

                    "metadata": metadata or {},

                    "distance": distance,

                }

            )

        return retrieved

    def search(
        self,
        question: str,
        top_k: int = 5,
    ):

        embedding = self.get_embedding(question)

        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            include=[
                "documents",
                "metadatas",
                "distances",
            ],
        )

        return self._format_results(results)
    
    @staticmethod
    def build_context(results):

        table_docs = []

        relationship_docs = []

        column_docs = []

        for result in results:

            document_type = result["metadata"].get(

                "document_type",

                "column",

            )

            if document_type == "table":

                table_docs.append(result["text"])

            elif document_type == "relationship":

                relationship_docs.append(result["text"])

            else:

                column_docs.append(result["text"])

        sections = []

        if table_docs:

            sections.append(

                "DATABASE SUMMARY\n\n"

                + "\n\n".join(table_docs)

            )

        if relationship_docs:

            sections.append(

                "TABLE RELATIONSHIPS\n\n"

                + "\n\n".join(relationship_docs)

            )

        if column_docs:

            sections.append(

                "COLUMN DETAILS\n\n"

                + "\n\n".join(column_docs)

            )

        return "\n\n====================\n\n".join(

            sections

        )
    
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

        return self._format_results(results)