from sqlalchemy import text

from app.database import engine


class SQLService:

    def execute_query(self, sql: str):

        with engine.connect() as connection:

            result = connection.execute(text(sql))

            rows = result.mappings().all()

            return rows