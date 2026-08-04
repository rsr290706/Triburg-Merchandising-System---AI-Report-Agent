from typing import List

from llama_index.core.base.embeddings.base import BaseEmbedding
from pydantic import PrivateAttr

from app.vectorstore.chroma_client import ChromaService


class ChromaEmbedding(BaseEmbedding):
    _chroma: ChromaService = PrivateAttr()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._chroma = ChromaService()

    def _get_query_embedding(self, query):
        return self._chroma.get_embedding_sync(query)

    def _get_text_embedding(self, text):
        return self._chroma.get_embedding_sync(text)

    async def _aget_query_embedding(self, query):
        return await self._chroma.get_embedding(query)

    async def _aget_text_embedding(self, text):
        return await self._chroma.get_embedding(text)