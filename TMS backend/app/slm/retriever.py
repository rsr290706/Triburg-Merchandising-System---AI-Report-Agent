from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.chroma import ChromaVectorStore
from app.slm.postprocessor import SchemaPostProcessor
from app.vectorstore.chroma_client import ChromaService


class SchemaRetriever:

    def __init__(self):

        chroma = ChromaService()

        vector_store = ChromaVectorStore(
            chroma_collection=chroma.collection
        )

        self.index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
        )

        self.retriever = self.index.as_retriever(
            similarity_top_k=5
        )

    async def retrieve(
        self,
        question,
        top_k=5,
    ):

        self.retriever.similarity_top_k = top_k

        nodes = self.retriever.retrieve(question)

        print("Before filtering")

        for node in nodes:
            print(node.node.node_id, node.score)

        processors = SchemaPostProcessor.build()

        for processor in processors:

            before = len(nodes)

            nodes = processor.postprocess_nodes(
                nodes,
                query_str=question,
            )

            print(
                f"{processor.__class__.__name__}: "
                f"{before} -> {len(nodes)}"
            )

        print("After filtering")

        for node in nodes:
            print(node.node.node_id, node.score)

        for processor in processors:

          before = len(nodes)
      
          nodes = processor.postprocess_nodes(
              nodes,
              query_str=question,
          )
      
          print(
              processor.__class__.__name__,
              before,
              "->",
              len(nodes),
          )

        results = []

        for node in nodes:

          print(node.node.node_id)

        for node in nodes:

            results.append(
                {
                    "id": node.node.node_id,
                    "text": node.text,
                    "metadata": node.metadata,
                    "distance": 1 - node.score,
                }
            )

        return results