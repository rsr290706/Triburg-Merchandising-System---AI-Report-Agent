from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

import pandas as pd

from app.database import engine

from app.services.schema_profiler import SchemaProfiler
from app.services.schema_metadata_service import SchemaMetadataService

from app.metadata.date_detection import detect_date_columns
from app.metadata.numeric_detection import detect_numeric_columns


class SchemaService:

    def __init__(self):

        self.profiler = SchemaProfiler()

        self.metadata_service = SchemaMetadataService()
    

    async def load_table_dataframe(
          self,
          connection: AsyncConnection,
          table_name: str,
          limit: int = 1000,
      ) -> pd.DataFrame:
      
          query = text(
              f"""
              SELECT *
              FROM `{table_name}`
              LIMIT {limit}
              """
          )
      
          result = await connection.execute(query)
      
          rows = result.mappings().all()
      
          return pd.DataFrame(rows)

    async def build_schema_documents(self):

        table_metadata = await self.metadata_service.get_table_metadata()

        documents = []

        async with engine.connect() as connection:

            for table_name, metadata in table_metadata.items():

                df = await self.load_table_dataframe(
                    connection,
                    table_name,
                )
                # Skip empty tables
                if df.empty:
                    continue

                df.columns = self.profiler.clean_columns(df.columns)

                df = detect_date_columns(df)
                df = detect_numeric_columns(df)

                table_document = self.profiler.profile_table(
                    table_name=table_name,
                    table_metadata=metadata,
                )

                documents.append(table_document)

                for relationship in metadata["foreign_keys"]:

                    relationship_document = self.profiler.profile_relationship(
                        table_name=table_name,
                        relationship=relationship,
                    )

                    documents.append(
                        relationship_document
                    )

                for column in df.columns:

                    document = self.profiler.profile_column(
                        table_name=table_name,
                        series=df[column],
                        column=column,
                    )

                    documents.append(document)

        return documents