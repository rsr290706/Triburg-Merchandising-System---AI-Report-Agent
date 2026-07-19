import asyncio
from app.services.schema_service import SchemaService
from app.vectorstore.chroma_client import ChromaService


async def ingest():

    print("Step 1: Creating services")

    schema_service = SchemaService()

    chroma = ChromaService()

    print("Step 2: Building schema documents")

    documents = await schema_service.build_schema_documents()

    print(f"Found {len(documents)} documents")

    print("Clearing existing schema...")

    chroma.clear_schema()

    print("Step 3: Uploading documents")

    chroma.add_documents(documents)

    print(f"Inserted {len(documents)} documents")

    print("Documents in collection:", chroma.collection.count())


if __name__ == "__main__":
    asyncio.run(ingest())