import httpx
import textwrap
import re
from app.config import OLLAMA_URL, MODEL_NAME
from app.prompts.sql_prompts import (
    MYSQL_CORE_PROMPT,
    MYSQL_ADVANCED_PROMPT,
    SQLITE_CORE_PROMPT,
    SQLITE_ADVANCED_PROMPT,
    is_simple_query,
)

OLLAMA_URL = OLLAMA_URL + "/chat"

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
    def build_schema_context(
        results,
        max_columns: int = 15,
    ):

        table_docs = []
        relationship_docs = []
        column_docs = []

        for result in results:

            document_type = result["metadata"].get(
                "document_type",
                "column"
            )

            if document_type == "table":

                table_docs.append(result["text"])

            elif document_type == "relationship":

                relationship_docs.append(result["text"])

            else:

                column_docs.append(result["text"])

        # Limit ONLY the column documents
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

        if relationship_docs:
            sections.append(
                "TABLE RELATIONSHIPS\n\n"
                + "\n\n".join(relationship_docs)
            )

        if column_docs:
            sections.append(
                "COLUMN DEFINITIONS\n\n"
                + "\n\n".join(column_docs)
            )

        return "\n\n====================\n\n".join(sections)

    async def generate_sql(
        self,
        retrieved_schema: list[dict],
        user_query: str,
    ):
        schema = self.build_schema_context(retrieved_schema)

        system_prompt = MYSQL_CORE_PROMPT

        if not is_simple_query(user_query):
            system_prompt += "\n\n" + MYSQL_ADVANCED_PROMPT

        prompt = f"""
                Database Schema

                {schema}

                User Question

                {user_query}
                """

        payload = {
            "model": MODEL_NAME,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False,
            "think": False,
            "keep_alive": "130m",
            "options": {
                "temperature": 0,
                "num_ctx": 2048,
                "num_batch": 512,
                "num_predict": 64
            }
        }

        try:
                response = await self._client.post(
                    OLLAMA_URL,
                    json=payload,
                )
                response.raise_for_status()
                return response.json()["message"]["content"].strip()

        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Ollama returned {e.response.status_code}: {e.response.text}"
            )
        
        except httpx.ConnectError:
            raise RuntimeError(
                "Cannot connect to Ollama. Make sure 'ollama serve' is running."
            )

        except Exception as e:
            raise RuntimeError(f"AI generation failed: {e}")
        
    async def generate_file_sql(self, schema: str, user_query: str):
        
        system_prompt = SQLITE_CORE_PROMPT

        if not is_simple_query(user_query):
            print("Using SQLITE ADVANCED prompt")
            system_prompt += "\n\n" + SQLITE_ADVANCED_PROMPT
        else:
            print("Using SQLITE CORE prompt")

        prompt = f"""
                Uploaded File Schema

                {schema}

                User Question

                {user_query}
                """

        payload = {
            "model": MODEL_NAME,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False,
            "think": False,
            "keep_alive": "30m",
            "options": {
                "temperature": 0,
                "num_ctx": 2048,
                "num_batch": 256,
                "num_predict": 64
            }
        }

        try:
                response = await self._client.post(
                    OLLAMA_URL,
                    json=payload,
                )
                response.raise_for_status()
                response_json = response.json()
                output = response_json["message"]["content"].strip()
                
                print("=" * 80)
                print("RAW MODEL OUTPUT")
                print(output)
                print("=" * 80)
                
                # Remove markdown code fences
                output = re.sub(r"```sql|```", "", output, flags=re.IGNORECASE).strip()
                
                # Extract the first SELECT or WITH statement
                match = re.search(
                    r"(?is)\b(SELECT|WITH)\b.*?;",
                    output,
                )
                
                if match:
                    return match.group(0).strip()
                
                raise RuntimeError(
                    f"Model did not return executable SQL:\n\n{output}"
                )

        except httpx.HTTPError:
            raise RuntimeError(
                "Cannot connect to Ollama. Make sure 'ollama serve' is running."
            )

        except Exception as e:
            raise RuntimeError(f"AI generation failed: {e}")
        
    async def close(self):
        await self._client.aclose()

    