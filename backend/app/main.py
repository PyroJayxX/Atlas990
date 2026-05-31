from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.lookalike import router as lookalike_router
from routers.scoring import router as scoring_router

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
app.include_router(scoring_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}