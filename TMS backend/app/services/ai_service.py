import httpx
from app.config import OLLAMA_URL, MODEL_NAME

class AIService:

    async def generate_sql(self, schema: str, user_query: str):

        system_prompt = """
                        You are an expert MySQL SQL generator.

                        Rules:

                        1. Use ONLY the schema provided.

                        2. Never invent tables.

                        3. Never invent columns.

                        4. Return ONLY executable MySQL.

                        5. Never return markdown.

                        6. Never explain.

                        7. Always wrap column and table names in backticks (`) to avoid reserved word conflicts.

                        8. If the schema is insufficient,
                        return exactly:

                        INSUFFICIENT_SCHEMA

                        followed by a brief explanation.

                        9. Never guess.
                        """

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
            "options": {
                "temperature": 0,
                "num_ctx": 4096
            }
        }

        try:
             async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(OLLAMA_URL, json=payload)
                response.raise_for_status()
                return response.json()["message"]["content"].strip()

        except httpx.HTTPError:
            raise RuntimeError(
                "Cannot connect to Ollama. Make sure 'ollama serve' is running."
            )

        except Exception as e:
            raise RuntimeError(f"AI generation failed: {e}")