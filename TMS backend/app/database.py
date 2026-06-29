from sqlalchemy import create_engine

from app.config import (
    DB_USER,
    DB_PASSWORD,
    DB_HOST,
    DB_NAME
)


DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
