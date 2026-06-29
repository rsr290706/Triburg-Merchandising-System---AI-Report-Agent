from fastapi import APIRouter
from fastapi import HTTPException
from app.schemas.query_schema import QueryRequest
from app.services.sql_service import SQLService
from app.services.ai_service import AIService
from app.services.rag_service import RAGService
from app.utils.sql_validator import validate_sql

router = APIRouter()

ai_service = AIService()
sql_service = SQLService()
rag_service = RAGService()


@router.post("/query")
def query(request: QueryRequest):

    sql = None
    schema = None

    try:

        schema = rag_service.retrieve_schema(request.question)

        sql = ai_service.generate_sql(
            schema=schema,
            user_query=request.question
        )

        validate_sql(sql)

        rows = sql_service.execute_query(sql)

        return {
            "generated_sql": sql,
            "result": rows
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail={
                "schema": schema,
                "sql": sql,
                "error": str(e)
            }
        )