import json
import uuid

from app.vectorstore.chroma_client import ChromaService

class SemanticCacheService:

    def __init__(self):

        self.chroma = ChromaService()

    def clear(self):

        print("[Semantic Cache] Clearing cache...")

        data = self.chroma.cache_collection.get(include=[])

        ids = data.get("ids", [])

        if len(ids) == 0:

            print("[Semantic Cache] Already empty.")

            return

        self.chroma.cache_collection.delete(ids=ids)

        print(f"[Semantic Cache] Deleted {len(ids)} entries.")
    
    def search(self, question: str, threshold: float = 0.85):

        print("=" * 50)
        print("[Semantic Cache] Searching...")
        print("Question:", question)

        embedding = self.chroma.get_embedding(question)

        results = self.chroma.cache_collection.query(
            query_embeddings=[embedding],
            n_results=1,
            include=["documents", "metadatas", "distances"]
        )

        if not results["documents"] or not results["documents"][0]:
            print("[Semantic Cache] MISS (empty cache)")
            print("=" * 50)
            return None

        distance = results["distances"][0][0]

        print("Distance:", distance)

        similarity = 1 - distance
        print("Similarity:", similarity)

        if similarity < threshold:
            print("[Semantic Cache] MISS (below threshold)")
            print("=" * 50)
            return None

        print("[Semantic Cache] HIT")
        print("Matched Question:", results["documents"][0][0])
        print("=" * 50)

        metadata = results["metadatas"][0][0]

        return {
            "generated_sql": metadata["sql"],
            "cached": True
        }
    
    def store(self, question, sql):
      embedding = self.chroma.get_embedding(question)
  
      self.chroma.cache_collection.upsert(
          ids=[str(uuid.uuid4())],
          documents=[question],
          embeddings=[embedding],
          metadatas=[{
              "sql": sql,
          }]
      )
