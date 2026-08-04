import re
import sqlglot
from sqlglot import exp

ALLOWED_TABLES = {
    "buyerdivision",
    "country",
    "factory",
    "merchant",
    "orders",
    "qa",
    "style",
    "team",
    "team_group",
}


def validate_sql(sql: str) -> str:

    sql = sql.strip()

    if sql.startswith("```"):

        sql = re.sub(r"^```sql\s*", "", sql, flags=re.IGNORECASE)
        sql = re.sub(r"^```", "", sql)
        sql = sql.replace("```", "")
        sql = sql.strip()
    
    statements = [s.strip() for s in sql.split(";") if s.strip()]

    if len(statements) != 1:
        raise ValueError(
            "Multiple SQL statements are not allowed."
        )

    sql = statements[0]

    try:
        parsed = sqlglot.parse_one(
            sql,
            read="mysql"
        )
    except Exception:
        raise ValueError("Invalid SQL syntax.")

    if not isinstance(parsed, (exp.Select, exp.With)):
        raise ValueError(
            "Only SELECT/WITH queries are allowed."
        )

    tables = {
        table.name.lower()
        for table in parsed.find_all(exp.Table)
    }

    invalid = tables - ALLOWED_TABLES

    if invalid:
        raise ValueError(
            f"Disallowed tables: {invalid}"
        )

    return parsed.sql(
        dialect="mysql"
    )