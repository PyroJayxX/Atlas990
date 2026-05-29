"""
extractor.py
Atlas990 — Phase 1 Data Pipeline
Pulls IRS Form 990 filings from the ProPublica Nonprofit Explorer API v2,
flattens the JSON response into structured records, and writes to Parquet.

API Base: https://projects.propublica.org/nonprofits/api/v2
Rate limit: polite delay enforced between requests (1.0s default)
Output:    backend/data/processed/filings.parquet
"""

import time
import logging
from pathlib import Path
from typing import Optional

import requests 
import pandas as pd  

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://projects.propublica.org/nonprofits/api/v2"
REQUEST_DELAY_SECONDS = 1.0       # be polite to ProPublica's servers
MAX_PAGES_PER_QUERY = 4           # 25 orgs/page × 4 pages = 100 orgs per NTEE category
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "processed"
OUTPUT_PATH = OUTPUT_DIR / "filings.parquet"

# NTEE category IDs to sweep across (1–10)
# Targeting the highest-value B2B segments for Atlas990
NTEE_TARGETS: list[dict] = [
    {"id": 2, "label": "Education"},
    {"id": 4, "label": "Health"},
    {"id": 5, "label": "Human Services"},
    {"id": 7, "label": "Public, Societal Benefit"},
]

# Core financial fields we want from each filing (formtype=0, i.e. full 990)
# These map directly to IRS 990 line items via ProPublica's field aliases
FILING_FIELDS: list[str] = [
    "ein",
    "tax_prd",
    "tax_prd_yr",
    "formtype",
    "totrevenue",           # Total revenue
    "totfuncexpns",         # Total functional expenses
    "totassetsend",         # Total assets, end of year
    "totliabend",           # Total liabilities, end of year
    "pct_compnsatncurrofcr",# % expenses: officer compensation
    # Extended 990 fields (present when formtype == 0)
    "prgmservrev",          # Program service revenue
    "grscontribs",          # Gross contributions & grants
    "invstmntinc",          # Investment income
    "txexmptbndsproceeds",  # Tax-exempt bond proceeds
    "royaltsinc",           # Royalties income
    "grsrntsreal",          # Gross rents — real property
    "grsrntsprsnl",         # Gross rents — personal property
    "rntlexpnsreal",        # Rental expenses — real property
    "rntlexpnsprsnl",       # Rental expenses — personal property
    "fundsrcvd",            # Net fundraising events income
    "lessdirfndrsng",       # Fundraising direct expenses
    "netincsales",          # Net income from sales of assets
    "miscrevtot11e",        # Miscellaneous revenue
    "compnsatncurrofcr",    # Compensation of current officers
    "othrsalwages",         # Other salaries and wages
    "payrolltx",            # Payroll taxes
    "profndraising",        # Professional fundraising fees
    "txblsalesprpty",       # Taxable sales of property
    "totprgmrevnue",        # Total program revenue
    "totnetassetend",       # Total net assets, end of year
    "nonpfrea",             # Reason for non-PF status
    "totemployee",          # Number of employees
    "totvoluntrs",          # Number of volunteers
]

# Organization profile fields to merge onto every filing row
ORG_FIELDS: list[str] = [
    "ein",
    "name",
    "address",
    "city",
    "state",
    "zipcode",
    "ntee_code",
    "subseccd",             # 501(c) subsection code
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("atlas990.extractor")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get(url: str, params: Optional[dict] = None) -> Optional[dict]:
    """
    Single HTTP GET with retry logic and polite delay.
    Returns parsed JSON dict or None on failure.
    """
    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        time.sleep(REQUEST_DELAY_SECONDS)
        return response.json()
    except requests.exceptions.HTTPError as e:
        log.warning("HTTP %s for %s — skipping", e.response.status_code, url)
    except requests.exceptions.RequestException as e:
        log.warning("Request failed for %s: %s — skipping", url, e)
    return None


# ---------------------------------------------------------------------------
# Step 1: Search — collect EINs by NTEE category
# ---------------------------------------------------------------------------

def fetch_eins_by_ntee(ntee_id: int, ntee_label: str, max_pages: int = MAX_PAGES_PER_QUERY) -> list[int]:
    """
    Paginate through /search.json for a given NTEE category.
    Returns a deduplicated list of integer EINs.
    """
    eins: list[int] = []

    for page in range(max_pages):
        params = {
            "ntee[id]": ntee_id,
            "c_code[id]": 3,   # 501(c)(3) only — core nonprofit segment
            "page": page,
        }
        data = _get(f"{BASE_URL}/search.json", params=params)

        if not data or not data.get("organizations"):
            log.info("  No more results for NTEE %s at page %d", ntee_label, page)
            break

        page_eins = [org["ein"] for org in data["organizations"] if org.get("ein")]
        eins.extend(page_eins)

        total_pages = data.get("num_pages", 1)
        log.info(
            "  NTEE %-25s page %d/%d — collected %d EINs (running total: %d)",
            ntee_label,
            page + 1,
            min(total_pages, max_pages),
            len(page_eins),
            len(eins),
        )

        if page + 1 >= total_pages:
            break

    return list(dict.fromkeys(eins))  # preserve order, deduplicate


# ---------------------------------------------------------------------------
# Step 2: Fetch — pull full filing history per EIN
# ---------------------------------------------------------------------------

def _extract_org_profile(org: dict) -> dict:
    """Pull the org-level fields we want from the organization sub-object."""
    return {field: org.get(field) for field in ORG_FIELDS}


def _extract_filing_row(filing: dict, org_profile: dict) -> dict:
    """
    Flatten a single filing object into a single dict row.
    Merges org profile fields onto the filing.
    Only processes formtype == 0 (full Form 990, not 990-EZ or 990-PF).
    """
    if filing.get("formtype") != 0:
        return {}

    row: dict = {}

    # Financial fields from the filing object
    for field in FILING_FIELDS:
        row[field] = filing.get(field)

    # Org profile fields (prefixed to avoid collisions with filing EIN)
    for field, value in org_profile.items():
        if field != "ein":   # already captured from filing
            row[f"org_{field}"] = value

    return row


def fetch_filings_for_ein(ein: int) -> list[dict]:
    """
    Fetch /organizations/:ein.json and return a list of flattened filing rows.
    Returns empty list if the org has no digitized 990 filings.
    """
    data = _get(f"{BASE_URL}/organizations/{ein}.json")

    if not data:
        return []

    org = data.get("organization", {})
    org_profile = _extract_org_profile(org)

    filings_with_data = data.get("filings_with_data", [])
    if not filings_with_data:
        return []

    rows: list[dict] = []
    for filing in filings_with_data:
        row = _extract_filing_row(filing, org_profile)
        if row:
            rows.append(row)

    return rows


# ---------------------------------------------------------------------------
# Step 3: Store — write flat records to Parquet
# ---------------------------------------------------------------------------

def save_to_parquet(records: list[dict], output_path: Path) -> None:
    """
    Convert list of flat dicts → pandas DataFrame → Parquet.
    Enforces consistent schema and coerces numeric columns.
    """
    if not records:
        log.error("No records to save. Parquet file not written.")
        return

    df = pd.DataFrame(records)

    # Coerce known numeric fields — API sometimes returns strings or None
    numeric_cols = [
        "totrevenue", "totfuncexpns", "totassetsend", "totliabend",
        "prgmservrev", "grscontribs", "invstmntinc", "compnsatncurrofcr",
        "othrsalwages", "payrolltx", "totemployee", "totvoluntrs",
        "totnetassetend", "totprgmrevnue", "pct_compnsatncurrofcr",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Enforce EIN as string with zero-padding to 9 digits
    if "ein" in df.columns:
        df["ein"] = df["ein"].astype(str).str.zfill(9)

    # Drop rows where all financial fields are null (useless rows)
    financial_cols = [c for c in numeric_cols if c in df.columns]
    df = df.dropna(subset=financial_cols, how="all")

    # Sort for deterministic Parquet layout
    df = df.sort_values(["ein", "tax_prd_yr"], ascending=[True, False]).reset_index(drop=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False, engine="pyarrow")

    log.info(
        "Saved %d filing rows across %d unique EINs → %s",
        len(df),
        df["ein"].nunique(),
        output_path,
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_extraction() -> None:
    """
    Full pipeline run:
    1. Sweep NTEE categories → collect EINs
    2. Fetch full filing data per EIN
    3. Flatten → Parquet
    """
    log.info("=== Atlas990 Extractor: Starting ===")

    all_eins: list[int] = []

    # Phase 1: EIN discovery
    for category in NTEE_TARGETS:
        log.info("Sweeping NTEE category %d: %s", category["id"], category["label"])
        eins = fetch_eins_by_ntee(category["id"], category["label"])
        all_eins.extend(eins)
        log.info("  → %d EINs collected for %s", len(eins), category["label"])

    # Global deduplication across categories
    all_eins = list(dict.fromkeys(all_eins))
    log.info("Total unique EINs to fetch: %d", len(all_eins))

    # Phase 2: Filing fetch
    all_records: list[dict] = []
    failed: int = 0

    for i, ein in enumerate(all_eins, start=1):
        rows = fetch_filings_for_ein(ein)

        if rows:
            all_records.extend(rows)
        else:
            failed += 1

        if i % 25 == 0 or i == len(all_eins):
            log.info(
                "Progress: %d/%d EINs fetched | %d filing rows | %d failed/empty",
                i, len(all_eins), len(all_records), failed,
            )

    # Phase 3: Write to Parquet
    log.info("Writing %d records to Parquet...", len(all_records))
    save_to_parquet(all_records, OUTPUT_PATH)

    log.info("=== Atlas990 Extractor: Complete ===")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_extraction()