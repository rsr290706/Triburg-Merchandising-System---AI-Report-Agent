from sqlalchemy import text
from app.database import engine


class SchemaService:
    """
    Responsible for reading the database schema.

    This service is ONLY used during the ingestion step.

    It should NOT be called every time the user asks a question.
    """

    def extract_schema(self):

        query = """
        SELECT
            TABLE_NAME,
            COLUMN_NAME,
            DATA_TYPE,
            COLUMN_KEY,
            IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION;
        """

        with engine.connect() as connection:

            result = connection.execute(text(query))

            rows = result.mappings().all()

        tables = {}

        for row in rows:

            table = row["TABLE_NAME"]

            if table not in tables:

                tables[table] = []

            tables[table].append({
                "column": row["COLUMN_NAME"],
                "datatype": row["DATA_TYPE"],
                "key": row["COLUMN_KEY"],
                "nullable": row["IS_NULLABLE"]
            })

        return tables


def build_schema_documents(self):

    schema = self.extract_schema()

    documents = []

    for table, columns in schema.items():

        text_document = f"Table: {table}\n"

        text_document += "Columns:\n"

        for column in columns:

            text_document += (
                f"- {column['column']} "
                f"({column['datatype']})"
            )

            if column["key"] == "PRI":
                text_document += " PRIMARY KEY"

            text_document += "\n"

        documents.append({

            "table": table,

            "text": text_document

        })

    return documents



