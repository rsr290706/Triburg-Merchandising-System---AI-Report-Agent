from __future__ import annotations

from sqlalchemy import text

from app.database import engine


class SchemaMetadataService:

    async def get_columns(self):

        query = """
        SELECT
            TABLE_NAME,
            COLUMN_NAME,
            DATA_TYPE,
            COLUMN_KEY,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            ORDINAL_POSITION
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY
            TABLE_NAME,
            ORDINAL_POSITION;
        """

        async with engine.connect() as connection:

            result = await connection.execute(
                text(query)
            )

            return result.mappings().all()
        
    async def get_primary_keys(self):

        query = """
        SELECT
            TABLE_NAME,
            COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = DATABASE()
        AND
            COLUMN_KEY='PRI';
        """

        async with engine.connect() as connection:

            result = await connection.execute(
                text(query)
            )

            return result.mappings().all()
        
    async def get_foreign_keys(self):

        query = """
        SELECT

            TABLE_NAME,

            COLUMN_NAME,

            REFERENCED_TABLE_NAME,

            REFERENCED_COLUMN_NAME

        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE

        WHERE

            TABLE_SCHEMA = DATABASE()

        AND

            REFERENCED_TABLE_NAME IS NOT NULL

        ORDER BY

            TABLE_NAME,

            COLUMN_NAME;
        """

        async with engine.connect() as connection:

            result = await connection.execute(
                text(query)
            )

            return result.mappings().all()
        
    async def get_row_counts(self):

        query = """
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE();
        """

        async with engine.connect() as connection:

            result = await connection.execute(
                text(query)
            )

            tables = [
                row.TABLE_NAME
                for row in result
            ]

            counts = {}

            for table in tables:

                count_query = text(
                    f"""
                    SELECT COUNT(*)
                    FROM `{table}`
                    """
                )

                count = await connection.scalar(
                    count_query
                )

                counts[table] = count

        return counts
    
    async def get_tables(self):

        query = """
        SELECT
            TABLE_NAME
        FROM
            INFORMATION_SCHEMA.TABLES
        WHERE
            TABLE_SCHEMA = DATABASE()
        ORDER BY
            TABLE_NAME;
        """

        async with engine.connect() as connection:

            result = await connection.execute(
                text(query)
            )

            return [
                row.TABLE_NAME
                for row in result
            ]
        
    async def get_database_metadata(self):

        metadata = {

            "tables": await self.get_tables(),

            "columns": await self.get_columns(),

            "primary_keys": await self.get_primary_keys(),

            "foreign_keys": await self.get_foreign_keys(),

            "row_counts": await self.get_row_counts(),

        }

        return metadata
    
    async def get_table_metadata(self):

        database = await self.get_database_metadata()

        table_metadata = {}

        for table in database["tables"]:

            table_metadata[table] = {
                "columns": [],
                "primary_keys": [],
                "foreign_keys": [],
                "row_count": database["row_counts"].get(table, 0),
            }

        for column in database["columns"]:

            table_metadata[
                column["TABLE_NAME"]
            ]["columns"].append(column)

        for primary_key in database["primary_keys"]:

            table_metadata[
                primary_key["TABLE_NAME"]
            ]["primary_keys"].append(
                primary_key["COLUMN_NAME"]
            )

        for foreign_key in database["foreign_keys"]:

            table_metadata[
                foreign_key["TABLE_NAME"]
            ]["foreign_keys"].append(
                {
                    "column": foreign_key["COLUMN_NAME"],
                    "references_table": foreign_key["REFERENCED_TABLE_NAME"],
                    "references_column": foreign_key["REFERENCED_COLUMN_NAME"],
                }
            )

        return table_metadata