from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.query import router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://triburg-merchandising-system-ai-rep.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)