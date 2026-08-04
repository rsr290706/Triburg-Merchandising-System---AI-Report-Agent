import httpx
import re
from collections import defaultdict

from app.config import OLLAMA_URL, MODEL_NAME
from app.prompts.sqlcoder_prompt import build_mysql_prompt, build_sqlite_prompt
from app.services.sql_normalizer import SQLNormalizer

GENERATE_URL = OLLAMA_URL + "/generate"


def _strip_fences(text: str) -> str:
    return re.sub(r"```sql|```", "", text, flags=re.IGNORECASE).strip()


def _extract_sql_or_raise(raw_output: str) -> str:
    cleaned = _strip_fences(raw_output).strip()

    match = re.search(
        r"(?is)(SELECT|WITH)\b.*?;",
        cleaned,
    )

    if match:
        return match.group(0).strip()

    match = re.search(
        r"(?is)(SELECT|WITH)\b.*",
        cleaned,
    )

    if match:
        return match.group(0).strip() + ";"

    raise RuntimeError(
        "SQLCoder did not generate executable SQL.\n\n"
        f"Raw output:\n{raw_output}"
    )


def compress_column_docs(column_docs):

    grouped = defaultdict(list)

    for doc in column_docs:

        table = re.search(r"Table:\s*(\w+)", doc)
        column = re.search(r"Column:\s*(\w+)", doc)

        if not table or not column:
            continue

        grouped[table.group(1)].append(column.group(1))

    output = []

    for table, cols in grouped.items():

        output.append(
            f"Table: {table}\n"
            "Columns:\n"
            + "\n".join(f"- {c}" for c in sorted(cols))
        )

    return "\n\n".join(output)


class AIService:

    def __init__(self):
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=10.0,
                read=120.0,
                write=30.0,
                pool=30.0,
            ),
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
            ),
        )

    @staticmethod
    def compress_table_doc(text: str) -> str:
    
        table = re.search(r"Table:\s*(\w+)", text)
        columns = re.search(r"Columns:\s*(.*)", text, re.DOTALL)
    
        if not table:
            return text
    
        output = [
            f"Table: {table.group(1)}"
        ]
    
        if columns:
            output.append("Columns:")
            output.append(columns.group(1).strip())
    
        return "\n".join(output)

    @staticmethod
    def build_schema_context(
        results,
        user_query: str,
        max_columns: int = 15,
    ):
        table_docs = []
        relationship_docs = []
        column_docs = []

        question = user_query.lower()

        tables = {
            r["metadata"].get("table")
            for r in results
            if r["metadata"].get("table")
        }
        
        include_relationships = len(tables) > 1

        for result in results:
            document_type = result["metadata"].get(
                "document_type",
                "column",
            )

            if document_type == "table":
                table_docs.append(
                    AIService.compress_table_doc(result["text"])
                )
            elif document_type == "relationship":
                relationship_docs.append(result["text"])
            else:
                column_docs.append(result["text"])

        column_docs = column_docs[:max_columns]

        print("=" * 80)
        print(f"Retrieved docs : {len(results)}")
        print(f"Column docs    : {len(column_docs)}")
        print("=" * 80)

        sections = []

        if table_docs:
            sections.append(
                "DATABASE SUMMARY\n\n"
                + "\n\n".join(table_docs)
            )

        if include_relationships and relationship_docs:
            sections.append(
                "TABLE RELATIONSHIPS\n\n"
                + "\n\n".join(relationship_docs)
            )

        if column_docs:
            sections.append(
                "COLUMN DEFINITIONS\n\n"
                + compress_column_docs(column_docs)
            )

        return "\n\n====================\n\n".join(sections)

    async def _post_and_log(self, payload: dict) -> dict:
        response = await self._client.post(GENERATE_URL, json=payload)
        response.raise_for_status()
        data = response.json()

        prompt_tokens = data.get("prompt_eval_count")
        output_tokens = data.get("eval_count")
        done_reason = data.get("done_reason")
        num_ctx = payload.get("options", {}).get("num_ctx", "N/A")

        print(
            "[Ollama] "
            f"prompt_tokens={prompt_tokens} "
            f"output_tokens={output_tokens} "
            f"done_reason={done_reason} "
            f"num_ctx={num_ctx}"
        )

        if (
            prompt_tokens is not None
            and isinstance(num_ctx, int)
            and prompt_tokens >= num_ctx - 32
        ):
            print(
                "[Ollama] WARNING: prompt_tokens is at/near num_ctx "
                f"({num_ctx}) -- the response "
                "likely had little or no token budget left. Increase "
                "num_ctx or shorten the prompt / schema context."
            )

        return data

    async def _generate_from_prompt(self, prompt: str, label: str = "SQLCODER") -> str:
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "30m",
            "options": {
            "temperature": 0,
            "num_ctx": 1024,
            "num_predict": 256,
        }
        }

        data = await self._post_and_log(payload)
        raw_output = data["response"].strip()

        print("=" * 80)
        print(f"RAW {label} OUTPUT")
        print(raw_output)
        print("=" * 80)

        sql = SQLNormalizer.normalize(raw_output)
        return _extract_sql_or_raise(sql)

    async def generate_sql(
        self,
        retrieved_schema: list[dict],
        user_query: str,
    ):
        schema = self.build_schema_context(
            retrieved_schema,
            user_query,
        )

        prompt = build_mysql_prompt(schema, user_query)

        try:
            return await self._generate_from_prompt(prompt)

        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Ollama returned {e.response.status_code}: {e.response.text}"
            )

        except httpx.ConnectError:
            raise RuntimeError(
                "Cannot connect to Ollama. Is Ollama running?"
            )

        except RuntimeError:
            raise

        except Exception as e:
            raise RuntimeError(
                f"SQL generation failed: {e}"
            )

    async def generate_file_sql(self, schema: str, user_query: str):
        prompt = build_sqlite_prompt(schema, user_query)

        try:
            return await self._generate_from_prompt(
                prompt,
                label="SQLCODER FILE",
            )

        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Ollama returned {e.response.status_code}: {e.response.text}"
            )

        except httpx.ConnectError:
            raise RuntimeError(
                "Cannot connect to Ollama. Is Ollama running?"
            )

        except RuntimeError:
            raise

        except Exception as e:
            raise RuntimeError(
                f"SQL generation failed: {e}"
            )

    async def close(self):
        await self._client.aclose()
