from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.slm.settings

from app.routes.query import router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
