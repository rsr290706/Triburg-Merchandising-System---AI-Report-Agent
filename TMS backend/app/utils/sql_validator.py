FORBIDDEN_KEYWORDS = {
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "INSERT",
    "TRUNCATE",
    "CREATE"
}


def validate_sql(sql: str) -> str:
    """
    Validate AI generated SQL.
    Only SELECT queries are allowed.
    """

    sql_upper = sql.upper()

    # Must start with SELECT
    if not sql_upper.strip().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed.")

    # Check forbidden keywords
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in sql_upper:
            raise ValueError(f"Forbidden SQL keyword detected: {keyword}")

    return sql