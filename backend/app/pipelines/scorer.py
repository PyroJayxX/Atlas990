"""
scorer.py
Atlas990 — Rules-Based Formula Scorer
Computes a deterministic 0–100 priority score from the 6 engineered
financial ratios using a fixed weighted formula. No model required.

Output: backend/data/processed/scored_orgs_formula.parquet
"""

import numpy as np
import pandas as pd
from pathlib import Path

# Paths

DATA_DIR    = Path(__file__).parent.parent.parent / "data" / "processed"
MATRIX_PATH = DATA_DIR / "feature_matrix.parquet"
OUTPUT_PATH = DATA_DIR / "scored_orgs_formula.parquet"

WEIGHTS: dict[str, float] = {
    "program_expense_ratio":  0.30,
    "revenue_yoy_growth":     0.25,
    "solvency_ratio":         0.20,
    "net_asset_margin":       0.15,
    "admin_overhead_ratio":  -0.10,  # inverted — high overhead penalizes score
}


def compute_formula_scores(fm: pd.DataFrame) -> pd.DataFrame:
    """
    Apply weighted formula to normalized feature matrix.
    Returns DataFrame with ein, org metadata, raw_score, and lead_score (0–100).
    """
    raw_score = pd.Series(np.zeros(len(fm)), index=fm.index)

    for feature, weight in WEIGHTS.items():
        if feature not in fm.columns:
            raise ValueError(f"Feature '{feature}' not found in feature matrix.")
        raw_score += weight * fm[feature]

    # Normalize to 0–100
    score_min = raw_score.min()
    score_max = raw_score.max()
    lead_score = ((raw_score - score_min) / (score_max - score_min) * 100).round(1)

    result = fm[["ein", "org_name", "org_state", "org_ntee_code", "tax_prd_yr"]].copy()
    result["raw_score"]  = raw_score.round(6)
    result["lead_score"] = lead_score
    result["scorer"]     = "formula"

    # Attach the individual weighted contributions for explainability
    for feature, weight in WEIGHTS.items():
        result[f"contrib_{feature}"] = (weight * fm[feature]).round(6)

    return result.sort_values("lead_score", ascending=False).reset_index(drop=True)


def run() -> None:
    fm = pd.read_parquet(MATRIX_PATH)
    print(f"Loaded feature matrix: {fm.shape[0]} orgs")

    scored = compute_formula_scores(fm)

    scored.to_parquet(OUTPUT_PATH, index=False, engine="pyarrow")

    print(f"Scored {len(scored)} orgs")
    print(f"Score range: {scored['lead_score'].min()} – {scored['lead_score'].max()}")
    print(f"Output → {OUTPUT_PATH.resolve()}")
    print("\nTop 10:")
    print(scored[["org_name", "org_state", "org_ntee_code", "lead_score"]].head(10).to_string())


if __name__ == "__main__":
    run()