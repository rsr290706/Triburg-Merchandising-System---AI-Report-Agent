from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.query import router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://triburg-merchandising-system-ai-report-agent-mn6lx16se.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)