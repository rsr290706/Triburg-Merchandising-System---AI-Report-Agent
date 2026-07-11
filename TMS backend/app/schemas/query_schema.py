from pydantic import BaseModel


class QueryRequest(BaseModel):
    question: str
    dataset_id: str | None = None


class FileImportRequest(BaseModel):
    filename: str
    content_base64: str
