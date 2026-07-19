from dotenv import load_dotenv
import os

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
OLLAMA_URL = os.getenv("OLLAMA_URL")
MODEL_NAME = os.getenv("MODEL_NAME")
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")

LH1 = os.getenv("LH1")
LH2 = os.getenv("LH2")