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
from fastapi.responses import StreamingResponse
import pandas as pd
import io


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

        rows = await sql_service.execute_query(sql)

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
    
@router.post("/export")
async def export_excel(request: QueryRequest):

    sql = None
    schema = None

    try:
        # Reuse the result from /query if this exact question was already run,
        # so we don't pay for a second LLM call and risk slightly different SQL
        # producing a different export than what the user saw in the table.
        cache_key = hashlib.md5(request.question.strip().lower().encode()).hexdigest()
        cached = query_cache.get(cache_key)

        if cached:
            print(f"[export cache hit] {request.question[:60]}")
            sql = cached["generated_sql"]
            rows = cached["result"]
        else:
            schema = rag_service.retrieve_schema(request.question)

            sql = await ai_service.generate_sql(
                schema=schema,
                user_query=request.question
            )

            validate_sql(sql)

            rows = await sql_service.execute_query(sql)

            query_cache[cache_key] = {
                "generated_sql": sql,
                "result": rows,
                "duration_ms": 0
            }

        df = pd.DataFrame(rows)

        # Write to an in-memory buffer instead of a temp file on disk, so
        # there's nothing left over to clean up after the response is sent.
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=TMS_Report.xlsx"
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "schema": schema,
                "sql": sql,
                "error": str(e)
            }
        )