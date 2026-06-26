from sqlalchemy import create_engine, text

from app.config import (
    DB_USER,
    DB_PASSWORD,
    DB_HOST,
    DB_NAME
)


DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
)

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT 1"))
    print(result.scalar())