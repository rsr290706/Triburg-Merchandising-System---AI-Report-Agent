import io
import re
import sqlite3
import uuid
from typing import Any
from app.vectorstore.chroma_client import ChromaService
import pandas as pd


class ImportedFileService:

    def __init__(self):
        self.datasets: dict[str, dict[str, Any]] = {}
        self.chroma = ChromaService()

    async def store_upload(self, filename: str, content: bytes):
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if extension == "csv":
            df = pd.read_csv(io.BytesIO(content))
        elif extension in {"xlsx", "xls"}:
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise ValueError("Only CSV, XLS, and XLSX files are supported.")

        if df.empty:
            raise ValueError("The uploaded file does not contain any rows.")

        df = df.copy()
        df.columns = self._clean_columns(df.columns)
        
        documents = self.build_schema_documents(df)
        self.chroma.clear_file_schema()

        print("=" * 60)
        print(f"Built {len(documents)} schema documents.")
        print("=" * 60)

        dataset_id = str(uuid.uuid4())

        for document in documents:

            self.chroma.add_file_document(

                id=f"{dataset_id}-{document['id']}",

                text=document["text"],

                dataset_id=dataset_id

            )

        print("=" * 60)
        print(
            "Documents stored:",
            self.chroma.file_schema_collection.count()
        )
        print("=" * 60)

        self.datasets[dataset_id] = {
            "filename": filename,
            "dataframe": df,
        }

        return {
            "dataset_id": dataset_id,
            "filename": filename,
            "row_count": int(len(df)),
            "columns": list(df.columns),
            "preview": self._records(df.head(5)),
            "schema": self.schema_for(dataset_id),
        }

    def schema_for(self, dataset_id: str):
        df = self._get_dataframe(dataset_id)
        lines = ["Table: uploaded_data"]

        for column in df.columns:
            sample_values = [
                self._truncate(str(value))
                for value in df[column].dropna().head(2).tolist()
            ]
            samples = ", ".join(sample_values) if sample_values else "no non-empty samples"
            lines.append(f"- `{column}` ({df[column].dtype}) examples: {samples}")

        return "\n".join(lines)
    
    def build_schema_documents(
        self,
        df: pd.DataFrame
    ):
        documents = []
        for column in df.columns:
            dtype = str(df[column].dtype)
            sample_values = (
                df[column]
                .dropna()
                .astype(str)
                .unique()[:5]
            )
            document = f"""
                        Table: uploaded_data

                        Column: {column}

                        Data Type: {dtype}

                        Example Values:

                        {", ".join(sample_values)}
                        """
            documents.append({

                "id": column,

                "text": document

            })
        return documents

    def _truncate(self, value: str, max_len: int = 30) -> str:
        return value if len(value) <= max_len else value[:max_len] + "..."

    def execute_query(self, dataset_id: str, sql: str):
        df = self._get_dataframe(dataset_id)

        with sqlite3.connect(":memory:") as connection:
            df.to_sql("uploaded_data", connection, index=False, if_exists="replace")
            cursor = connection.execute(sql)
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]

        return [dict(zip(columns, row)) for row in rows]

    def export_rows(self, rows: list[dict[str, Any]]):
        return pd.DataFrame(rows)

    def _get_dataframe(self, dataset_id: str):
        dataset = self.datasets.get(dataset_id)
        if not dataset:
            raise ValueError("Imported file not found. Please upload the file again.")
        return dataset["dataframe"]

    def _records(self, df: pd.DataFrame):
        clean = df.astype(object).where(pd.notnull(df), None)
        return clean.to_dict(orient="records")

    def _clean_columns(self, columns):
        used: set[str] = set()
        cleaned = []

        for index, column in enumerate(columns, start=1):
            name = str(column).strip() if column is not None else ""
            if not name or name.lower().startswith("unnamed:"):
                name = f"column_{index}"

            name = re.sub(r"\s+", " ", name)
            base = name
            suffix = 2

            while name in used:
                name = f"{base}_{suffix}"
                suffix += 1

            used.add(name)
            cleaned.append(name)

        return cleaned
