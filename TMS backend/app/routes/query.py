from fastapi import APIRouter
from app.schemas.query_schema import QueryRequest
from app.services.sql_service import SQLService
from app.utils.sql_validator import validate_sql
from app.services.ai_service import AIService
from app.services.rag_service import RAGService

router = APIRouter()
ai_service = AIService()
sql_service = SQLService()
rag_service = RAGService()

@router.post("/query")
def query(request: QueryRequest):

    schema = rag_service.retrieve_schema(request.question)

    sql = ai_service.generate_sql(
        question=request.question,
        schema=schema
    )

    validate_sql(sql)

    rows = sql_service.execute_query(sql)

    return {
        "question": request.question,
        "retrieved_schema": schema,
        "generated_sql": sql,
        "result": rows
    }
