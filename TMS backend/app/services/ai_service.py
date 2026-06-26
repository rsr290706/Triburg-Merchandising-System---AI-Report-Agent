import os
from openai import OpenAI

class AIService:

    def __init__(self):

        self.client = OpenAI(
            api_key="YOUR_API_KEY"
        )
        self.model = "gpt-5.5"

    def generate_sql(self, question: str, schema: str):
        system_prompt = f"""
                        You are an expert MySQL SQL developer.

                        Your job is to convert natural language into SQL.

                        Rules:
                        1. Return ONLY SQL.
                        2. Never explain your answer.
                        3. Never use markdown.
                        4. Never use ```sql.
                        5. Never invent table names.
                        6. Never invent column names.
                        7. Only generate SELECT statements.
                        8. Never generate UPDATE, DELETE, INSERT, DROP, ALTER, or TRUNCATE.
                        9. Use only the schema provided.

                        Database Schema:
                        {schema}
                        """
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": question
                }
            ]
        )

        sql = response.choices[0].message.content.strip()

        return sql


