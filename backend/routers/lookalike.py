import numpy as np
import pandas as pd
import faiss
from pathlib import Path
from functools import lru_cache
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["lookalike"])

# Paths
DATA_DIR    = Path(__file__).parent.parent / "data" / "processed"
MODELS_DIR  = Path(__file__).parent.parent / "data" / "models"

CLEAN_PATH  = DATA_DIR  / "filings_clean.parquet"
MATRIX_PATH = DATA_DIR  / "feature_matrix.parquet"

# Feature columns — must match transformer output exactly

ENGINEERED_FEATURES = [
    "program_expense_ratio",
    "admin_overhead_ratio",
    "net_asset_margin",
    "labor_cost_ratio",
    "solvency_ratio",
    "revenue_yoy_growth",
]

RAW_DISPLAY_FIELDS = [
    "totrevenue",
    "totassetsend",
    "totliabend",
    "totfuncexpns",
    "totprgmrevnue",
    "compnsatncurrofcr",
    "othrsalwages",
]

# Pydantic response models

class OrgProfile(BaseModel):
    ein:                    str
    org_name:               str
    org_state:              str | None
    org_city:               str | None
    org_ntee_code:          str | None
    tax_prd_yr:             int
    totrevenue:             float | None
    totassetsend:           float | None
    program_expense_ratio:  float | None
    admin_overhead_ratio:   float | None
    net_asset_margin:       float | None
    labor_cost_ratio:       float | None
    solvency_ratio:         float | None
    revenue_yoy_growth:     float | None


class LookalikeResult(OrgProfile):
    rank:         int
    l2_distance:  float


class LookalikeResponse(BaseModel):
    target:     OrgProfile
    lookalikes: list[LookalikeResult]


# In-memory state — built once at first request, reused for all subsequent

class FAISSEngine:
    def __init__(self) -> None:
        self.index:   faiss.Index | None = None
        self.lookup:  pd.DataFrame | None = None
        self.vectors: np.ndarray | None = None
        self.feature_cols: list[str] = []

    def load(self) -> None:
        """
        Load feature matrix, extract float32 vectors, build FAISS index.
        Called once on first request — subsequent calls are no-ops.
        """
        if self.index is not None:
            return  # already loaded

        fm = pd.read_parquet(MATRIX_PATH)

        # Identify feature columns — everything except metadata
        meta = {"ein", "org_name", "org_state", "org_ntee_code", "tax_prd_yr"}
        self.feature_cols = [c for c in fm.columns if c not in meta]

        # Lookup table maps FAISS integer indices → org metadata
        self.lookup = fm[["ein", "org_name", "org_state", "org_ntee_code", "tax_prd_yr"]].reset_index(drop=True)

        # Float32 matrix
        self.vectors = fm[self.feature_cols].values.astype(np.float32)

        # Build index
        n_features   = self.vectors.shape[1]
        self.index   = faiss.IndexFlatL2(n_features)
        self.index.add(self.vectors)

    def search(self, ein: str, k: int = 5) -> tuple[list[int], list[float]]:
        """
        Find the top-k nearest neighbors for a given EIN.
        Returns (indices, distances) excluding the query org itself.
        """
        self.load()

        matches = self.lookup[self.lookup["ein"] == ein]
        if matches.empty:
            raise HTTPException(
                status_code=404,
                detail=f"EIN {ein} not found in feature matrix. "
                       f"Ensure the org has a digitized 990 filing."
            )

        idx          = matches.index[0]
        query_vector = self.vectors[idx].reshape(1, -1)

        distances, indices = self.index.search(query_vector, k + 1)

        # Drop index 0 — always the query org itself (distance=0)
        result_indices   = indices[0][1:].tolist()
        result_distances = distances[0][1:].tolist()

        return result_indices, result_distances


# Singleton engine instance
_engine = FAISSEngine()


# Helpers

@lru_cache(maxsize=1)
def _load_clean() -> pd.DataFrame:
    """Load filings_clean.parquet once and cache it."""
    return pd.read_parquet(CLEAN_PATH)


def _get_org_profile(ein: str, clean_df: pd.DataFrame) -> dict:
    """
    Pull the most recent filing for an EIN from filings_clean.parquet.
    Returns a dict of display fields with raw (un-normalized) values.
    """
    rows = clean_df[clean_df["ein"] == ein].sort_values("tax_prd_yr", ascending=False)

    if rows.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No clean filing data found for EIN {ein}"
        )

    row = rows.iloc[0]

    return {
        "ein":                   str(row["ein"]),
        "org_name":              str(row.get("org_name", "")),
        "org_state":             row.get("org_state"),
        "org_city":              row.get("org_city"),
        "org_ntee_code":         row.get("org_ntee_code"),
        "tax_prd_yr":            int(row["tax_prd_yr"]),
        "totrevenue":            _safe_float(row.get("totrevenue")),
        "totassetsend":          _safe_float(row.get("totassetsend")),
        "program_expense_ratio": _safe_float(row.get("program_expense_ratio")),
        "admin_overhead_ratio":  _safe_float(row.get("admin_overhead_ratio")),
        "net_asset_margin":      _safe_float(row.get("net_asset_margin")),
        "labor_cost_ratio":      _safe_float(row.get("labor_cost_ratio")),
        "solvency_ratio":        _safe_float(row.get("solvency_ratio")),
        "revenue_yoy_growth":    _safe_float(row.get("revenue_yoy_growth")),
    }


def _safe_float(value) -> float | None:
    """Convert numpy scalars and NaN to Python float or None."""
    try:
        f = float(value)
        return None if np.isnan(f) else round(f, 6)
    except (TypeError, ValueError):
        return None


# Endpoint

@router.get("/lookalike/{ein}", response_model=LookalikeResponse)
async def get_lookalikes(ein: str, k: int = 6) -> LookalikeResponse:
    """
    Return the top-K financially similar organizations for a given EIN.

    Parameters
    ----------
    ein : str   Nine-digit EIN (with or without hyphen — normalized internally)
    k   : int   Number of lookalikes to return (default 6, max 20)

    Returns
    -------
    LookalikeResponse
        target    → full org profile with raw financial ratios
        lookalikes → ranked list of similar orgs with l2_distance
    """
    # Normalize EIN — strip hyphens, zero-pad to 9 digits
    ein_clean = ein.replace("-", "").zfill(9)

    k = min(k, 20)  # cap at 20

    clean_df = _load_clean()

    # Build target profile
    target_profile = _get_org_profile(ein_clean, clean_df)

    # Run FAISS search
    result_indices, result_distances = _engine.search(ein_clean, k=k)

    # Build lookalike profiles
    lookalikes: list[LookalikeResult] = []

    for rank, (idx, dist) in enumerate(zip(result_indices, result_distances), start=1):
        lookalike_ein = _engine.lookup.iloc[idx]["ein"]
        profile       = _get_org_profile(lookalike_ein, clean_df)

        lookalikes.append(
            LookalikeResult(
                rank=rank,
                l2_distance=round(float(dist), 6),
                **profile,
            )
        )

    return LookalikeResponse(
        target=OrgProfile(**target_profile),
        lookalikes=lookalikes,
    )

class OrgSummary(BaseModel):
    ein:          str
    org_name:     str
    org_state:    str | None
    org_city:     str | None
    org_ntee_code: str | None
    tax_prd_yr:   int
    totrevenue:   float | None
    totassetsend: float | None


class OrgListResponse(BaseModel):
    total: int
    orgs:  list[OrgSummary]


@router.get("/organizations", response_model=OrgListResponse)
async def get_organizations() -> OrgListResponse:
    """
    Return all orgs in the feature matrix (one row per org, most recent filing).
    Used to populate the dataset table on the frontend.
    """
    _engine.load()

    clean_df = _load_clean()

    # Most recent filing per EIN — same slice as feature_matrix
    latest = (
        clean_df
        .sort_values("tax_prd_yr", ascending=False)
        .drop_duplicates(subset="ein")
        .reset_index(drop=True)
    )

    # Filter to only EINs that are in the feature matrix
    valid_eins = set(_engine.lookup["ein"].tolist())
    latest = latest[latest["ein"].isin(valid_eins)]

    orgs: list[OrgSummary] = []
    for _, row in latest.iterrows():
        orgs.append(OrgSummary(
            ein=          str(row["ein"]),
            org_name=     str(row.get("org_name", "")),
            org_state=    row.get("org_state"),
            org_city=     row.get("org_city"),
            org_ntee_code=row.get("org_ntee_code"),
            tax_prd_yr=   int(row["tax_prd_yr"]),
            totrevenue=   _safe_float(row.get("totrevenue")),
            totassetsend= _safe_float(row.get("totassetsend")),
        ))

    # Sort by revenue descending — largest orgs first in the table
    orgs.sort(key=lambda o: o.totrevenue or 0, reverse=True)

    return OrgListResponse(total=len(orgs), orgs=orgs)