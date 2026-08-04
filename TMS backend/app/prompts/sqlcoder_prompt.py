def build_mysql_prompt(schema: str, question: str):

    return f"""
You are an expert MySQL Text-to-SQL engine.

Generate exactly ONE executable MySQL query.

Rules:

- Return ONLY SQL.
- Generate exactly one SELECT statement.
- Use ONLY tables and columns from the schema.
- Never invent tables.
- Never invent columns.
- Use only relationships present in the schema.
- Wrap reserved MySQL table names in backticks.
- Prefer descriptive columns (team_name, merchant_name, factory_name) unless IDs are requested.
- For simple questions involving one table, generate a direct SELECT query.
- If and ONLY IF the required table or column does not exist, return:

SELECT 'INSUFFICIENT_SCHEMA';

Schema:

{schema}

Question:

{question}

SQL:
"""

def build_sqlite_prompt(schema: str, question: str) -> str:
    return f"""
    You are an expert SQLite Text-to-SQL engine.
    
    Generate exactly ONE executable SQLite SELECT query.
    
    Rules:
    
    - Return ONLY SQL.
    - Generate exactly one SELECT statement.
    - Use ONLY tables and columns from the schema.
    - Never invent tables.
    - Never invent columns.
    - Use only relationships present in the schema.
    - Wrap reserved SQLite table names in backticks.
    - Prefer descriptive columns (team_name, merchant_name, factory_name) unless IDs are requested.
    - For simple questions involving one table, generate a direct SELECT query.
    - If and ONLY IF the required table or column does not exist, return:
    
    SELECT 'INSUFFICIENT_SCHEMA';
    
    Schema:
    
    {schema}
    
    Question:
    
    {question}
    
    SQL:
    """