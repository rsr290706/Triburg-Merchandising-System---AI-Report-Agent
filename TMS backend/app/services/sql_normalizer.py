import re
class SQLNormalizer:

    @staticmethod
    def normalize(sql: str) -> str:
        sql = re.sub(
            r"\s+NULLS\s+(FIRST|LAST)",
            "",
            sql,
            flags=re.IGNORECASE,
        )

        sql = re.sub(
            r"\bILIKE\b",
            "LIKE",
            sql,
            flags=re.IGNORECASE,
        )

        sql = sql.strip()

        return sql