from __future__ import annotations

from datetime import datetime
import io
import re
import sqlite3
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pandas as pd

from app.vectorstore.chroma_client import ChromaService
from app.services.schema_profiler import SchemaProfiler

from app.metadata.date_detection import detect_date_columns
from app.metadata.numeric_detection import detect_numeric_columns

_MAX_PROFILING_WORKERS = 8


class ImportedFileService:

    def __init__(self):
        self.datasets: dict[str, dict[str, Any]] = {}
        self.chroma = ChromaService()
        self.profiler = SchemaProfiler()

    def store_upload(self, filename: str, content: bytes):
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
        df = detect_date_columns(df)
        df = detect_numeric_columns(df)

        dataset_id = str(uuid.uuid4())
        documents = self.build_schema_documents(df)

        self.chroma.clear_file_schema()
        self._add_documents_to_chroma(documents, dataset_id)

        print("=" * 60)
        print(f"Built {len(documents)} schema documents.")
        print("Documents stored:", self.chroma.file_schema_collection.count())
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

    def _add_documents_to_chroma(self, documents: list[dict[str, Any]], dataset_id: str) -> None:

        try:
            self.chroma.add_file_documents(
                documents=documents,
                dataset_id=dataset_id,
                metadatas=[doc["metadata"] for doc in documents],
            )
        except TypeError:
            self.chroma.add_file_documents(documents=documents, dataset_id=dataset_id)

    def build_schema_documents(self, df: pd.DataFrame) -> list[dict[str, Any]]:
 
        columns = list(df.columns)
        worker_count = min(_MAX_PROFILING_WORKERS, max(1, len(columns)))

        with ThreadPoolExecutor(max_workers=worker_count) as executor:

            documents = list(
                executor.map(
                    lambda column: self.profiler.profile_column(
                        table_name="uploaded_data",
                        series=df[column],
                        column=column,
                    ),
                    columns,
                )
            )

        return documents

    def schema_for(self, dataset_id: str) -> str:
        df = self._get_dataframe(dataset_id)
        lines = ["Table: uploaded_data"]

        for column in df.columns:
            sample_values = [self._truncate(str(value)) for value in df[column].dropna().head(2).tolist()]
            samples = ", ".join(sample_values) if sample_values else "no non-empty samples"
            semantic_type = self.profiler.infer_column_meaning(column).get(
                "semantic_type",
                "Unknown",
            )
            lines.append(f"- `{column}` ({df[column].dtype}, {semantic_type}) examples: {samples}")

        return "\n".join(lines)


    def execute_query(self, dataset_id: str, sql: str):
        df = self._get_dataframe(dataset_id)

        with sqlite3.connect(":memory:") as connection:
            df.to_sql("uploaded_data", connection, index=False, if_exists="replace")
            cursor = connection.execute(sql)
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            result = []
            for row in rows:
                record = {}
                for column, value in zip(columns, row):
                    # Format datetime strings
                    if isinstance(value, str):
                        # YYYY-MM-DD HH:MM:SS
                        try:
                            dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                            value = dt.strftime("%d-%m-%Y")
                        except ValueError:
                            pass
                        # YYYY-MM-DD
                        try:
                            dt = datetime.strptime(value, "%Y-%m-%d")
                            value = dt.strftime("%d-%m-%Y")
                        except ValueError:
                            pass
                    record[column] = value
                result.append(record)
        return result

    def export_rows(self, rows: list[dict[str, Any]]):
        return pd.DataFrame(rows)

    def _get_dataframe(self, dataset_id: str) -> pd.DataFrame:
        dataset = self.datasets.get(dataset_id)
        if not dataset:
            raise ValueError("Imported file not found. Please upload the file again.")
        return dataset["dataframe"]

    def _records(self, df: pd.DataFrame):
        clean = df.astype(object).where(pd.notnull(df), None)
        return clean.to_dict(orient="records")

    def _truncate(self, value: str, max_len: int = 30) -> str:
        return value if len(value) <= max_len else value[:max_len] + "..."

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
