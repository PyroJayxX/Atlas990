"""
scoring.py
Atlas990 — /api/v1/scores/formula and /api/v1/scores/model
Serves both the rules-based formula scores and the XGBoost model scores.
"""

import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from functools import lru_cache
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/scores", tags=["scoring"])

# Paths

DATA_DIR    = Path(__file__).parent.parent / "data" / "processed"
MODELS_DIR  = Path(__file__).parent.parent / "data" / "models"

FORMULA_PATH = DATA_DIR   / "scored_orgs_formula.parquet"
MATRIX_PATH  = DATA_DIR   / "feature_matrix.parquet"
MODEL_PATH   = MODELS_DIR / "xgboost_scorer.pkl"
NORM_PATH    = MODELS_DIR / "score_norm.pkl"

# Pydantic models

class ScoredOrg(BaseModel):
    ein:          str
    org_name:     str
    org_state:    str | None
    org_ntee_code: str | None
    tax_prd_yr:   int
    lead_score:   float
    scorer:       str   # "formula" or "model"


class ScoreContribution(BaseModel):
    feature: str
    weight:  float
    contrib: float


class ScoredOrgDetail(ScoredOrg):
    contributions: list[ScoreContribution]


class ScoresResponse(BaseModel):
    scorer:  str
    total:   int
    orgs:    list[ScoredOrg]


class ScoreDetailResponse(BaseModel):
    scorer:       str
    org:          ScoredOrgDetail
    score_label:  str
    score_note:   str


# Loaders — cached after first call

@lru_cache(maxsize=1)
def _load_formula_scores() -> pd.DataFrame:
    if not FORMULA_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Formula scores not found. Run scorer.py first."
        )
    return pd.read_parquet(FORMULA_PATH)


@lru_cache(maxsize=1)
def _load_feature_matrix() -> pd.DataFrame:
    return pd.read_parquet(MATRIX_PATH)


@lru_cache(maxsize=1)
def _load_model():
    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="XGBoost model not found. Run xgboost_scoring.ipynb first."
        )
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


@lru_cache(maxsize=1)
def _load_norm_params() -> dict:
    if not NORM_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Normalization params not found. Run xgboost_scoring.ipynb first."
        )
    with open(NORM_PATH, "rb") as f:
        return pickle.load(f)


# Helpers

META_COLS = {"ein", "org_name", "org_state", "org_ntee_code", "tax_prd_yr"}

FORMULA_WEIGHTS: dict[str, float] = {
    "program_expense_ratio":  0.30,
    "revenue_yoy_growth":     0.25,
    "solvency_ratio":         0.20,
    "net_asset_margin":       0.15,
    "admin_overhead_ratio":  -0.10,
}

def _safe_float(value) -> float:
    try:
        f = float(value)
        return 0.0 if np.isnan(f) else round(f, 4)
    except (TypeError, ValueError):
        return 0.0


def _compute_model_scores() -> pd.DataFrame:
    """Run XGBoost inference on the full feature matrix."""
    fm     = _load_feature_matrix()
    model  = _load_model()
    norm   = _load_norm_params()

    feature_cols = [c for c in fm.columns if c not in META_COLS]
    X = fm[feature_cols].values.astype("float32")

    raw_preds = model.predict(X)
    scores    = np.clip(raw_preds, 0, 100).round(1)

    result = fm[["ein", "org_name", "org_state", "org_ntee_code", "tax_prd_yr"]].copy()
    result["lead_score"] = scores
    result["scorer"]     = "model"

    return result.sort_values("lead_score", ascending=False).reset_index(drop=True)


# Endpoints

@router.get("/formula", response_model=ScoresResponse)
async def get_formula_scores(
    limit:  int = Query(default=344, ge=1,  le=500),
    offset: int = Query(default=0,   ge=0),
) -> ScoresResponse:
    """
    Return orgs ranked by the rules-based weighted formula score.
    Scores are deterministic — no model involved.
    """
    df = _load_formula_scores()

    page = df.iloc[offset : offset + limit]

    orgs = [
        ScoredOrg(
            ein=          str(row["ein"]),
            org_name=     str(row["org_name"]),
            org_state=    row.get("org_state"),
            org_ntee_code=row.get("org_ntee_code"),
            tax_prd_yr=   int(row["tax_prd_yr"]),
            lead_score=   float(row["lead_score"]),
            scorer=       "formula",
        )
        for _, row in page.iterrows()
    ]

    return ScoresResponse(scorer="formula", total=len(df), orgs=orgs)


@router.get("/model", response_model=ScoresResponse)
async def get_model_scores(
    limit:  int = Query(default=344, ge=1,  le=500),
    offset: int = Query(default=0,   ge=0),
) -> ScoresResponse:
    """
    Return orgs ranked by the XGBoost model score.
    Model trained on synthetic labels — see score_note in detail endpoint.
    """
    df = _compute_model_scores()

    page = df.iloc[offset : offset + limit]

    orgs = [
        ScoredOrg(
            ein=          str(row["ein"]),
            org_name=     str(row["org_name"]),
            org_state=    row.get("org_state"),
            org_ntee_code=row.get("org_ntee_code"),
            tax_prd_yr=   int(row["tax_prd_yr"]),
            lead_score=   float(row["lead_score"]),
            scorer=       "model",
        )
        for _, row in page.iterrows()
    ]

    return ScoresResponse(scorer="model", total=len(df), orgs=orgs)


@router.get("/formula/{ein}", response_model=ScoreDetailResponse)
async def get_formula_score_detail(ein: str) -> ScoreDetailResponse:
    """
    Return the formula score for a single org with per-feature
    contribution breakdown for explainability.
    """
    ein_clean = ein.replace("-", "").zfill(9)
    df = _load_formula_scores()

    row = df[df["ein"] == ein_clean]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"EIN {ein_clean} not found.")

    row = row.iloc[0]

    contributions = [
        ScoreContribution(
            feature=feature,
            weight=weight,
            contrib=_safe_float(row.get(f"contrib_{feature}", 0.0)),
        )
        for feature, weight in FORMULA_WEIGHTS.items()
    ]

    return ScoreDetailResponse(
        scorer="formula",
        score_label="Rules-Based Priority Score",
        score_note=(
            "Computed from a fixed weighted formula across 5 financial ratios. "
            "Fully deterministic and explainable. "
            "No machine learning involved."
        ),
        org=ScoredOrgDetail(
            ein=          str(row["ein"]),
            org_name=     str(row["org_name"]),
            org_state=    row.get("org_state"),
            org_ntee_code=row.get("org_ntee_code"),
            tax_prd_yr=   int(row["tax_prd_yr"]),
            lead_score=   float(row["lead_score"]),
            scorer=       "formula",
            contributions=contributions,
        ),
    )


@router.get("/model/{ein}", response_model=ScoreDetailResponse)
async def get_model_score_detail(ein: str) -> ScoreDetailResponse:
    """
    Return the XGBoost model score for a single org.
    """
    ein_clean = ein.replace("-", "").zfill(9)
    df = _compute_model_scores()

    row = df[df["ein"] == ein_clean]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"EIN {ein_clean} not found.")

    row = row.iloc[0]

    fm           = _load_feature_matrix()
    feature_cols = [c for c in fm.columns if c not in META_COLS]
    model        = _load_model()

    org_row = fm[fm["ein"] == ein_clean]
    if org_row.empty:
        raise HTTPException(status_code=404, detail=f"EIN {ein_clean} not in feature matrix.")

    importances = model.feature_importances_
    contributions = [
        ScoreContribution(
            feature=feature,
            weight=round(float(importances[i]), 6),
            contrib=round(float(org_row[feature].values[0]) * importances[i], 6),
        )
        for i, feature in enumerate(feature_cols)
    ]

    return ScoreDetailResponse(
        scorer="model",
        score_label="XGBoost ML Score",
        score_note=(
            "Trained on a synthetic label derived from the weighted formula. "
            "Scores reflect learned approximations of the formula — not real conversion outcomes. "
            "Replace training labels with actual sales data to unlock true predictive power."
        ),
        org=ScoredOrgDetail(
            ein=          str(row["ein"]),
            org_name=     str(row["org_name"]),
            org_state=    row.get("org_state"),
            org_ntee_code=row.get("org_ntee_code"),
            tax_prd_yr=   int(row["tax_prd_yr"]),
            lead_score=   float(row["lead_score"]),
            scorer=       "model",
            contributions=contributions,
        ),
    )