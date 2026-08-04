from llama_index.core import Settings

from app.slm.embedding import ChromaEmbedding

Settings.embed_model = ChromaEmbedding()