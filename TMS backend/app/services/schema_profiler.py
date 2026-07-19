from __future__ import annotations

from typing import Any

import pandas as pd

from app.metadata.column_profiles import (
    COLUMN_PROFILES,
    DEFAULT_PROFILE,
)

from app.metadata.column_statistics import (
    compute_column_statistics,
    format_statistics,
)

from app.metadata.semantic_detection import (
    build_fallback_profile,
    match_known_profile,
)


from app.metadata.table_profiles import (
    TABLE_PROFILES,
    DEFAULT_TABLE_PROFILE,
)

_CURATED_PROFILE_MATCH_THRESHOLD = 0.82


class SchemaProfiler:

    def infer_column_meaning(self, column_name: str) -> dict[str, Any]:
    
        key = column_name.strip().lower().replace(" ", "_")

        curated = COLUMN_PROFILES.get(key)
        if curated is not None:
            return {**DEFAULT_PROFILE, **curated, "confidence": 1.0, "inferred": False}

        matched_key, score = match_known_profile(column_name, COLUMN_PROFILES)
        if matched_key is not None and score >= _CURATED_PROFILE_MATCH_THRESHOLD:
            curated = COLUMN_PROFILES[matched_key]
            return {
                **DEFAULT_PROFILE,
                **curated,
                "confidence": score,
                "inferred": True,
                "matched_via": matched_key,
            }

        return build_fallback_profile(column_name)
    
    @staticmethod
    def classify_datatype(series: pd.Series) -> str:
        if pd.api.types.is_numeric_dtype(series):
            return "Numeric"
        if pd.api.types.is_datetime64_any_dtype(series):
            return "Date"
        return "Text"
    
    @staticmethod
    def build_document_text(
        column,
        datatype,
        metadata,
        stats_text,
        examples: list[str],
        table_name="uploaded_data",
    ):
        
        header = f"Column: {column}"
        sections = [
            header,
            "-" * max(len(header), 12),
            f"Table: {table_name}",
        ]
        confidence = metadata.get("confidence")
        type_line = f"Type:\n{datatype} ({metadata.get('semantic_type', 'Unknown')})"
        if confidence is not None:
            type_line += f"\nConfidence: {confidence:.0%}"
        sections.append(type_line)

        if metadata.get("meaning"):
            sections.append(f"Meaning:\n{metadata['meaning']}")

        if metadata.get("description"):
            sections.append(f"Description:\n{metadata['description']}")

        if metadata.get("aliases"):
            sections.append("Aliases:\n" + ", ".join(metadata["aliases"]))

        if stats_text:
            sections.append(f"Statistics:\n{stats_text}")

        if examples:
            sections.append(
                "Example Values:\n" +
                ", ".join(examples)
            )

        if metadata.get("sql_usage"):
            sections.append(
                "SQL Usage:\n" +
                ", ".join(metadata["sql_usage"])
            )

        if metadata.get("business_rules"):
            sections.append("Business Rules:\n" + "\n".join(metadata["business_rules"]))

        if metadata.get("related_columns"):
            sections.append("Related Columns:\n" + ", ".join(metadata["related_columns"]))

        if metadata.get("common_queries"):
            sections.append("Common Queries:\n" + "\n".join(f"- {q}" for q in metadata["common_queries"]))

        return "\n\n".join(sections)
    
    def profile_column(
        self,
        table_name: str,
        series: pd.Series,
        column: str,
    ) -> dict[str, Any]:
        
        datatype = self.classify_datatype(series)
        metadata = self.infer_column_meaning(column)
        stats = compute_column_statistics(series, datatype)
        examples = (
            series
            .dropna()
            .astype(str)
            .unique()[:5]
            .tolist()
        )

        text = self.build_document_text(
            column=column,
            datatype=datatype,
            metadata=metadata,
            stats_text=format_statistics(stats),
            examples=examples,
            table_name=table_name,
        )

        chroma_metadata = {
            "table": table_name,
            "column": column,
            "datatype": datatype,
            "semantic_type": metadata.get("semantic_type", "Unknown"),
            "confidence": metadata.get("confidence", 1.0),
            "inferred": metadata.get("inferred", False),
            "unique_values": int(series.nunique()),
            "missing_values": int(series.isna().sum()),
            "document_type": "column",
        }

        return {
            "id": f"{table_name}.{column}",
            "text": text,
            "metadata": chroma_metadata,
        }
    
    def profile_table(
        self,
        table_name: str,
        table_metadata: dict,
    ) -> dict:

        profile = TABLE_PROFILES.get(
            table_name.lower(),
            DEFAULT_TABLE_PROFILE,
        )

        column_names = [
            column["COLUMN_NAME"]
            for column in table_metadata["columns"]
        ]

        foreign_keys = []

        for foreign_key in table_metadata["foreign_keys"]:

            foreign_keys.append(

                f"{foreign_key['column']} → "

                f"{foreign_key['references_table']}."

                f"{foreign_key['references_column']}"

            )

        text = f"""
    Table:
    {table_name}

    Category:
    {profile["category"]}

    Business Entity:
    {profile["business_entity"]}

    Purpose:
    {profile["purpose"]}

    Description:
    {profile["description"]}

    Owner:
    {profile["owner"]}

    Rows:
    {table_metadata["row_count"]}

    Primary Keys:
    {", ".join(table_metadata["primary_keys"]) or "None"}

    Foreign Keys:
    {chr(10).join(foreign_keys) if foreign_keys else "None"}

    Columns:
    {", ".join(column_names)}

    Primary Metrics:
    {", ".join(profile["primary_metrics"])}

    Dimensions:
    {", ".join(profile["dimensions"])}

    Common Queries:
    {chr(10).join(profile["common_queries"])}
    """

        return {

            "id": f"{table_name}.summary",

            "text": text,

            "metadata": {

                "table": table_name,

                "document_type": "table",

                "category": profile["category"],

                "business_entity": profile["business_entity"],

            },
        }
    
    def profile_relationship(
        self,
        table_name: str,
        relationship: dict,
    ) -> dict:

        text = f"""
    Relationship

    Source Table:
    {table_name}

    Source Column:
    {relationship["column"]}

    References Table:
    {relationship["references_table"]}

    References Column:
    {relationship["references_column"]}

    Meaning:

    Each record in {table_name}
    is linked to a record in
    {relationship["references_table"]}.

    SQL Join

    {table_name}.{relationship["column"]}

    =

    {relationship["references_table"]}.{relationship["references_column"]}
    """

        return {

            "id":

            f"{table_name}."

            f"{relationship['column']}."

            f"relationship",

            "text": text,

            "metadata": {

                "table": table_name,

                "column": relationship["column"],

                "references": relationship["references_table"],

                "relationship_type": "foreign_key",

                "document_type": "relationship",

            },
        }