from llama_index.core.schema import TextNode


class NodeBuilder:

    @staticmethod
    def build(documents):

        nodes = []

        for doc in documents:

            nodes.append(
                TextNode(
                    id_=doc["id"],
                    text=doc["text"],
                    metadata=doc.get("metadata", {}),
                )
            )

        return nodes