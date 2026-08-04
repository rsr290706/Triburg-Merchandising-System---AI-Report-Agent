from app.vectorstore.chroma_client import ChromaService
from app.metadata.semantic_detection import build_query_expansion
from app.metadata.column_profiles import COLUMN_PROFILES
from app.services.retrieval_ranker import RetrievalRanker
from app.slm.retriever import SchemaRetriever
from app.utils.query_complexity import is_simple_query
from rapidfuzz import process
import re

class RAGService:

    def __init__(self):
        self.vector_db = ChromaService()      # keep this for build_context()
        self.retriever = SchemaRetriever()    # new
        self.ranker = RetrievalRanker()

    async def retrieve_schema(self, question: str):

        expanded_question = build_query_expansion(
            question,
            COLUMN_PROFILES,
        )

        top_k = self.determine_top_k(question)

        results = await self.retriever.retrieve(
            expanded_question,
            top_k,
        )
        
        results = self.expand_related_documents(results)
        
        results = self.ranker.rerank(
            question,
            results,
        )

        context = self.vector_db.build_context(results)

        return {
            "context": context,
            "results": results,
        }

    def expand_related_documents(self, results):
        """
        Always include:
          - table summaries
          - relationship docs
          - summaries of referenced tables
        """
    
        expanded = list(results)
    
        existing_ids = {
            doc["id"]
            for doc in results
        }
    
        docs = self.vector_db.collection.get(
            include=["documents", "metadatas"],
        )
    
        # Build an index for fast lookup
        doc_index = {}
    
        for i, doc_id in enumerate(docs["ids"]):
            doc_index[doc_id] = {
                "text": docs["documents"][i],
                "metadata": docs["metadatas"][i],
            }
    
        tables = {
            doc["metadata"]["table"]
            for doc in results
            if "table" in doc["metadata"]
        }
    
        for table in tables:
    
            summary_id = f"{table}.summary"
    
            # ----------------------------
            # Add this table's summary
            # ----------------------------
            if (
                summary_id in doc_index
                and summary_id not in existing_ids
            ):
    
                expanded.append({
                    "id": summary_id,
                    "text": doc_index[summary_id]["text"],
                    "metadata": doc_index[summary_id]["metadata"],
                    "distance": 1.0,
                })
    
                existing_ids.add(summary_id)
    
            # ----------------------------
            # Add relationship documents
            # ----------------------------
            for doc_id, doc in doc_index.items():
    
                metadata = doc["metadata"]
    
                if (
                    metadata.get("document_type") == "relationship"
                    and metadata.get("table") == table
                ):
    
                    if doc_id not in existing_ids:
    
                        expanded.append({
                            "id": doc_id,
                            "text": doc["text"],
                            "metadata": metadata,
                            "distance": 1.0,
                        })
    
                        existing_ids.add(doc_id)
    
                    # ----------------------------
                    # NEW: Add referenced table summary
                    # ----------------------------
                    reference_table = metadata.get("references")
    
                    if reference_table:
    
                        referenced_summary = (
                            f"{reference_table}.summary"
                        )
    
                        if (
                            referenced_summary in doc_index
                            and referenced_summary not in existing_ids
                        ):
    
                            expanded.append({
                                "id": referenced_summary,
                                "text": doc_index[referenced_summary]["text"],
                                "metadata": doc_index[referenced_summary]["metadata"],
                                "distance": 1.0,
                            })
    
                            existing_ids.add(referenced_summary)
    
        return expanded
    
    def determine_top_k(
        self,
        question: str,
    ) -> int:

        if is_simple_query(question):
            return 5

        question = question.lower()

        table_names = [
            "buyerdivision",
            "country",
            "factory",
            "merchant",
            "orders",
            "qa",
            "style",
            "team",
            "team_group",
        ]

        synonyms = {
            "buyer": "buyerdivision",
            "buyers": "buyerdivision",
            "buyer division": "buyerdivision",
            "vendor": "merchant",
            "vendors": "merchant",
            "factory": "factory",
            "factories": "factory",
            "order": "orders",
            "orders": "orders",
            "team group": "team_group",
            "team groups": "team_group",
        }

        # Apply synonym replacement
        for alias, actual in synonyms.items():
            question = question.replace(alias, actual)

        # Tokenize the question
        words = re.findall(r"[a-zA-Z_]+", question)

        matched_tables = set()

        # Exact match
        for word in words:
            if word in table_names:
                matched_tables.add(word)

        # Fuzzy match for remaining words
        for word in words:
            if word in matched_tables:
                continue

            match = process.extractOne(
                word,
                table_names,
                score_cutoff=80,   # 80–85 works well
            )

            if match:
                matched_tables.add(match[0])

        print(f"[Retriever] Matched tables: {matched_tables}")

        matches = len(matched_tables)

        if matches >= 3:
            return 12

        elif matches == 2:
            return 10

        elif matches == 1:
            return 8

        return 6