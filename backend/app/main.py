"""
main.py
Atlas990 — FastAPI entrypoint
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.lookalike import router as lookalike_router

app = FastAPI(
    title="Atlas990 API",
    description="IRS 990 lead intelligence engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lookalike_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}