import base64
import io
import time
import traceback
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
from sqlalchemy import text
from app.database import engine

router = APIRouter()

file_rag = FileRAGService()
ai_service = AIService()
sql_service = SQLService()
rag_service = RAGService()
semantic_cache = SemanticCacheService()
imported_files = ImportedFileService()


@router.post(
    "/upload-file",
    responses={
        400: {
            "description": "Invalid uploaded file"
        }
    }
)
async def upload_file(request: FileImportRequest):
    try:
        content = base64.b64decode(request.content_base64)
        return imported_files.store_upload(request.filename or "uploaded_file", content)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": str(e)
            }
        )


@router.post(
    "/query",
    responses={
        500: {
            "description": "Query execution failed"
        }
    }
)

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

            print("=" * 80)
            print("FILE RAG OUTPUT")
            for item in schema:
                print(item["text"])
            print("=" * 80)

            schema_text = ai_service.build_schema_context(schema)

            sql = await ai_service.generate_file_sql(
                schema=schema_text,
                user_query=request.question,
            )

            print("=" * 80)
            print("GENERATED SQL")
            print(sql)
            print("=" * 80)

            rows = imported_files.execute_query(
                request.dataset_id,
                sql
            )

            duration = round(time.time() - start, 2)

            return {
                "generated_sql": sql,
                "result": rows,
                "duration_ms": int(duration * 1000),
                "source": "file"
            }

        print("STEP 1 - Semantic cache")

        cached = semantic_cache.search(request.question)
        
        print("STEP 2 - Cache finished")

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

        print("STEP 3 - Retrieving schema")

        schema = rag_service.retrieve_schema(request.question)
        
        print(schema)

        print("STEP 4 - Generating SQL")


        sql = await ai_service.generate_sql(
            retrieved_schema=schema["results"],
            user_query=request.question
        )
                
        print(sql)

        print("STEP 5 - Validating SQL")

        sql = validate_sql(sql)
        
        print(sql)
      
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
            sql
        )
        
        print("=" * 80)
        print(sql)
        print("=" * 80)

        return response

    except Exception as e:
      print("\n" + "=" * 80)
      print("QUERY FAILED")
      traceback.print_exc()
      print("=" * 80)
  
      raise HTTPException(
          status_code=500,
          detail={
              "schema": schema,
              "sql": sql,
              "error": str(e)
          }
      )

@router.post(
    "/clear-cache",
    responses={
        500: {
            "description": "Clear cache failed"
        }
    }
)
def clear_cache():

    semantic_cache.clear()

    return {

        "message":"Cache cleared."

    }

@router.post(
    "/export",
    responses={
        500: {
            "description": "Export failed"
        }
    }
)
async def export_excel(request: QueryRequest):

    sql = None
    schema = None

    try:
        if request.dataset_id:
            schema = file_rag.retrieve_schema(
                request.dataset_id,
                request.question
            )

            schema_text = ai_service.build_schema_context(schema)

            sql = await ai_service.generate_file_sql(
                schema=schema_text,
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
                    retrieved_schema=schema["results"],
                    user_query=request.question
                )

                sql = validate_sql(sql)
                rows = await sql_service.execute_query(sql)

                semantic_cache.store(
                    question=request.question,
                    sql=sql,
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
      
@router.get("/database-info")
async def database_info():

    async with engine.connect() as conn:

        db_result = await conn.execute(
            text("SELECT DATABASE();")
        )

        table_result = await conn.execute(
            text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE();
            """)
        )

        return {
            "database": db_result.scalar(),
            "tables": table_result.scalar()
        }