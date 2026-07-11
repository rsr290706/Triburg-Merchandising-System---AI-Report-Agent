import base64
import io
import time

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.query_schema import FileImportRequest, QueryRequest
from app.services.ai_service import AIService
from app.services.imported_file_service import ImportedFileService
from app.services.rag_service import RAGService
from app.services.semantic_cache_service import SemanticCacheService
from app.services.file_rag_service import FileRAGService
from app.services.sql_service import SQLService
from app.utils.sql_validator import validate_sql


router = APIRouter()

file_rag = FileRAGService()
ai_service = AIService()
sql_service = SQLService()
rag_service = RAGService()
semantic_cache = SemanticCacheService()
imported_files = ImportedFileService()


@router.post("/upload-file")
async def upload_file(request: FileImportRequest):
    try:
        content = base64.b64decode(request.content_base64)
        return await imported_files.store_upload(request.filename or "uploaded_file", content)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": str(e)
            }
        )


@router.post("/query")
async def query(request: QueryRequest):

    start = time.time()
    sql = None
    schema = None

    try:
        if request.dataset_id:
            schema = file_rag.retrieve_schema(
                request.dataset_id,
                request.question
            )

            sql = await ai_service.generate_file_sql(
                schema=schema,
                user_query=request.question
            )

            sql = validate_sql(sql)
            rows = imported_files.execute_query(request.dataset_id, sql)

            duration = round(time.time() - start, 2)

            return {
                "generated_sql": sql,
                "result": rows,
                "duration_ms": int(duration * 1000),
                "source": "file"
            }

        cached = semantic_cache.search(request.question)

        if cached:
            print("[Semantic Cache Hit]")

            sql = cached["generated_sql"]
            sql = validate_sql(sql)
            rows = await sql_service.execute_query(sql)

            duration = round(time.time() - start, 2)

            return {
                "generated_sql": sql,
                "result": rows,
                "duration_ms": int(duration * 1000),
                "cached": True,
                "source": "database"
            }

        schema = rag_service.retrieve_schema(request.question)

        sql = await ai_service.generate_sql(
            schema=schema,
            user_query=request.question
        )

        sql = validate_sql(sql)
        rows = await sql_service.execute_query(sql)

        duration = round(time.time() - start, 2)
        print(f"[{duration}s] {request.question[:60]}")

        response = {
            "generated_sql": sql,
            "result": rows,
            "duration_ms": int(duration * 1000),
            "source": "database"
        }

        semantic_cache.store(
            request.question,
            sql,
            rows
        )

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "schema": schema,
                "sql": sql,
                "error": str(e)
            }
        )

@router.post("/clear-cache")
async def clear_cache():

    semantic_cache.clear()

    return {

        "message":"Cache cleared."

    }

@router.post("/export")
async def export_excel(request: QueryRequest):

    sql = None
    schema = None

    try:
        if request.dataset_id:
            schema = file_rag.retrieve_schema(
                request.dataset_id,
                request.question
            )

            sql = await ai_service.generate_file_sql(
                schema=schema,
                user_query=request.question
            )

            sql = validate_sql(sql)
            rows = imported_files.execute_query(request.dataset_id, sql)
        else:
            cached = semantic_cache.search(request.question)

            if cached:
                print("[Semantic Cache Hit - Export]")

                sql = cached["generated_sql"]
                sql = validate_sql(sql)
                rows = await sql_service.execute_query(sql)
            else:
                schema = rag_service.retrieve_schema(request.question)

                sql = await ai_service.generate_sql(
                    schema=schema,
                    user_query=request.question
                )

                sql = validate_sql(sql)
                rows = await sql_service.execute_query(sql)

                semantic_cache.store(
                    question=request.question,
                    sql=sql,
                    result=rows
                )

        df = pd.DataFrame(rows)

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
