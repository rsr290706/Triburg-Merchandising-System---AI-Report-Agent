from sqlalchemy import text

from app.database import engine


class SQLService:

    async def execute_query(self, sql: str):

        async with engine.connect() as connection:

            result = await connection.execute(text(sql))

            rows = result.mappings().all()

            return [dict(row) for row in rows]