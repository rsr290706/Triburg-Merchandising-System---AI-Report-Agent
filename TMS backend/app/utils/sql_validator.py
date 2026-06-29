import re

FORBIDDEN_KEYWORDS = {
    "UNION",
    "INTO",
    "EXEC",
    "INFORMATION_SCHEMA",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "INSERT",
    "TRUNCATE",
    "CREATE"
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

    sql_upper = sql.upper()

    # Must start with SELECT
    if not sql_upper.strip().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed.")

    # Check forbidden keywords
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in sql_upper:
            raise ValueError(f"Forbidden SQL keyword detected: {keyword}")

    return sql