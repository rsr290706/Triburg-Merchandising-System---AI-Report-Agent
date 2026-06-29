from fastapi import APIRouter
from fastapi import HTTPException
from app.schemas.query_schema import QueryRequest
from app.services.sql_service import SQLService
from app.services.ai_service import AIService
from app.services.rag_service import RAGService
from app.utils.sql_validator import validate_sql
from functools import lru_cache
import hashlib
import time

router = APIRouter()

ai_service = AIService()
sql_service = SQLService()
rag_service = RAGService()

query_cache = {}

@router.post("/query")
async def query(request: QueryRequest):

    sql = None
    schema = None
    start = time.time()
    cache_key = hashlib.md5(request.question.strip().lower().encode()).hexdigest()
    if cache_key in query_cache:
        print(f"[cache hit] {request.question[:60]}")
        return query_cache[cache_key]

    sql = None
    schema = None

    try:
        schema = rag_service.retrieve_schema(request.question)

        sql = await ai_service.generate_sql(
            schema=schema,
            user_query=request.question
        )

        validate_sql(sql)

        rows = sql_service.execute_query(sql)

        duration = round(time.time() - start, 2)
        print(f"[{duration}s] {request.question[:60]}")

        result = {
            "generated_sql": sql,
            "result": rows,
            "duration_ms": int(duration * 1000)
        }

        query_cache[cache_key] = result
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "schema": schema,
                "sql": sql,
                "error": str(e)
            }
        )