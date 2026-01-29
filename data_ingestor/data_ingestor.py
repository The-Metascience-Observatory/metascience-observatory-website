"""
Ingestion Engine for Replications Database

This script processes spreadsheets containing replication experiment data
and adds them to the master replications database.

Usage:
    python ingestion_engine.py <input_csv_file> <master_database_csv>
    python ingestion_engine.py --skip-api-calls <input_csv_file> <master_database_csv>
"""

import pandas as pd
import numpy as np
import argparse
import time
import os
import re
import math
from datetime import datetime
from fetch_metadata_from_doi import fetch_metadata_from_doi
from fetch_metadata_from_title import fetch_metadata_from_title
from generate_citation_html_for_website import generate_citation_html_for_website

# Get the directory where this script lives
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')
VERSION_HISTORY_PATH = os.path.join(DATA_DIR, 'version_history.txt')


def get_latest_master_database():
    """Get the latest master database filename from version_history.txt"""
    if not os.path.exists(VERSION_HISTORY_PATH):
        return None

    with open(VERSION_HISTORY_PATH, 'r') as f:
        lines = f.readlines()

    # Find the last non-empty line
    for line in reversed(lines):
        line = line.strip()
        # Skip empty lines and comments
        if line and not line.startswith('#'):
            # Extract just the filename (remove any path prefix and comments)
            filename = line.split('#')[0].strip()
            # Handle both relative paths and just filenames
            if filename.startswith('../data/'):
                filename = filename.replace('../data/', '')
            return filename

    return None

def extract_doi_from_url(url):
    """Extract DOI from URL like 'http://doi.org/10.1234/xyz'"""
    if not isinstance(url, str) or not url.strip():
        return None
    url = url.strip()
    if url.startswith("http://doi.org/"):
        return url.replace("http://doi.org/", "")
    elif url.startswith("https://doi.org/"):
        return url.replace("https://doi.org/", "")
    return None

def normalize_doi(doi):
    """
    Normalize a DOI by removing any URL prefix.
    Handles cases where DOI might already be a full URL.
    Returns just the DOI part (e.g., '10.1234/xyz')
    """
    if not isinstance(doi, str) or not doi.strip():
        return None
    doi = doi.strip()
    # Strip common URL prefixes
    if doi.startswith("http://doi.org/"):
        doi = doi.replace("http://doi.org/", "")
    elif doi.startswith("https://doi.org/"):
        doi = doi.replace("https://doi.org/", "")
    elif doi.startswith("http://dx.doi.org/"):
        doi = doi.replace("http://dx.doi.org/", "")
    elif doi.startswith("https://dx.doi.org/"):
        doi = doi.replace("https://dx.doi.org/", "")
    return doi if doi else None

def is_empty(value):
    """Check if value is empty/missing"""
    return pd.isna(value) or value == "" or value == "NaN" or (isinstance(value, str) and not value.strip())


# =============================================================================
# EFFECT SIZE CONVERSION FUNCTIONS
# =============================================================================
# Based on formulas from effect_size_conversions.md and effect_size_transformations.R
# All conversions target Pearson's r as the common metric.

# Effect size types that cannot be reliably converted to r
CANNOT_CONVERT = {
    "beta (std)", "partial etasq", "χ2", "b (unstd)", "b", "etasq (partial)",
    "cramer's v", "dz", "beta", "percentage",
    "squared seminpartial correlation (sr2)", "regression coefficient",
    "unstandardized coefficient", "cohen's h", "h", "partial eta-squared",
    "semi-partial correlation", "cliff's delta", "w", "cohen's w"
}

# Mapping of effect size type aliases to canonical names
ESTYPE_MAP = {
    # Odds ratios and hazard ratios (HR uses same conversion as OR)
    "or": "or",
    "odds ratio": "or",
    "hr": "or",
    "hazard ratio": "or",
    "hazards ratio": "or",

    # Standardized mean differences (Cohen's d, Hedges' g, Glass' delta)
    "d": "d",
    "cohen's d": "d",
    "hedges' g": "d",
    "hedges'g": "d",
    "hedge's g": "d",
    "hedges g": "d",
    "hedgesg": "d",
    "smd": "d",
    "glass' delta": "d",
    "glass's delta": "d",
    "glass delta": "d",

    # Eta-squared (η²)
    "etasq": "eta2",
    "etaq": "eta2",
    "eta^2": "eta2",
    "η²": "eta2",
    "eta-squared": "eta2",

    # Cohen's f
    "f": "f",
    "cohen's f": "f",

    # Cohen's f²
    "f2": "f2",
    "f^2": "f2",
    "f²": "f2",
    "cohen's f^2": "f2",

    # Correlations (r / phi / Spearman's r)
    "r": "r",
    "phi": "r",
    "φ": "r",
    "pearson's r": "r",
    "pearson r": "r",
    "correlation": "r",
    "spearman's r": "r",
    "spearman r": "r",
    "spearman": "r",

    # R-squared (R²)
    "r2": "r2",
    "r^2": "r2",
    "r²": "r2",
    "r-square": "r2",
    "r-squared": "r2",

    # Test statistics
    "test statistic": "test-stat",
    "test statistics": "test-stat",
    "test": "test-stat",
}


def d_to_r(d, n1=None, n2=None):
    """
    Convert Cohen's d to Pearson's r.

    If sample sizes are provided, uses the exact formula:
        r = d / sqrt(d^2 + (n1 + n2)^2 / (n1 * n2))

    Otherwise uses the approximation (assumes equal sample sizes):
        r = d / sqrt(d^2 + 4)

    Sign is preserved.
    """
    if d is None or (isinstance(d, float) and math.isnan(d)):
        return None

    if n1 is not None and n2 is not None and n1 > 0 and n2 > 0:
        # Exact formula with sample sizes
        a = (n1 + n2) ** 2 / (n1 * n2)
        return d / math.sqrt(d ** 2 + a)
    else:
        # Approximation assuming equal sample sizes
        return d / math.sqrt(d ** 2 + 4)


def or_to_r(odds_ratio):
    """
    Convert Odds Ratio to Pearson's r.

    Two-step conversion:
    1. Convert OR to d: d = ln(OR) * sqrt(3) / π
    2. Convert d to r: r = d / sqrt(d^2 + 4)

    Sign is preserved (OR < 1 implies negative r).
    """
    if odds_ratio is None or (isinstance(odds_ratio, float) and math.isnan(odds_ratio)):
        return None
    if odds_ratio <= 0:
        return None

    d = math.log(odds_ratio) * math.sqrt(3) / math.pi
    return d_to_r(d)


def eta2_to_r(eta2):
    """
    Convert Eta-squared to Pearson's r.

    Two-step conversion:
    1. Convert η² to d: d = 2 * sqrt(η² / (1 - η²))
    2. Convert d to r: r = d / sqrt(d^2 + 4)

    Always positive.
    """
    if eta2 is None or (isinstance(eta2, float) and math.isnan(eta2)):
        return None
    if eta2 < 0 or eta2 >= 1:
        return None

    d = 2 * math.sqrt(eta2 / (1 - eta2))
    return d_to_r(d)


def f_to_r(f):
    """
    Convert Cohen's f to Pearson's r.

    Two-step conversion:
    1. Convert f to d: d = 2f
    2. Convert d to r: r = d / sqrt(d^2 + 4)

    Always positive.
    """
    if f is None or (isinstance(f, float) and math.isnan(f)):
        return None

    d = 2 * f
    return d_to_r(d)


def f2_to_r(f2):
    """
    Convert Cohen's f² to Pearson's r.

    Two-step conversion:
    1. Convert f² to R²: R² = f² / (1 + f²)
    2. Convert R² to r: r = sqrt(R²)

    Always positive.
    """
    if f2 is None or (isinstance(f2, float) and math.isnan(f2)):
        return None
    if f2 < 0:
        return None

    r2 = f2 / (1 + f2)
    return math.sqrt(r2)


def r2_to_r(r2):
    """
    Convert R-squared to Pearson's r.

    r = sqrt(R²)

    Always positive.
    """
    if r2 is None or (isinstance(r2, float) and math.isnan(r2)):
        return None
    if r2 < 0 or r2 > 1:
        return None

    return math.sqrt(r2)


def parse_test_statistic(stat_string):
    """
    Parse APA-formatted test statistics and convert to r.

    Supported formats:
    - t(df) = value        e.g., "t(10) = 2.5"
    - F(df1, df2) = value  e.g., "F(1, 20) = 4.5" (df1 must be 1)
    - z = value, N = value e.g., "z = 2.81, N = 34"
    - χ2(1, N = value) = value  e.g., "χ2(1, N = 12) = 5" (df must be 1)

    Returns r value or None if cannot be parsed/converted.
    """
    if not isinstance(stat_string, str):
        return None

    stat_string = stat_string.strip()

    # t-test: t(df) = value
    t_match = re.match(r'^t\((\d+)\)\s*=\s*(-?\d+\.?\d*)$', stat_string, re.IGNORECASE)
    if t_match:
        df = float(t_match.group(1))
        t_val = float(t_match.group(2))
        return t_val / math.sqrt(t_val ** 2 + df)

    # F-test: F(df1, df2) = value
    f_match = re.match(r'^f\((\d+)\s*,\s*(\d+)\)\s*=\s*(\d+\.?\d*)$', stat_string, re.IGNORECASE)
    if f_match:
        df1 = float(f_match.group(1))
        df2 = float(f_match.group(2))
        f_val = float(f_match.group(3))
        if df1 == 1:
            t_val = math.sqrt(f_val)
            return t_val / math.sqrt(t_val ** 2 + df2)
        else:
            return None  # Cannot convert F with df1 > 1

    # z-test: z = value, N = value
    z_match = re.match(r'^z\s*=\s*(-?\d+\.?\d*)\s*,\s*n\s*=\s*(\d+)$', stat_string, re.IGNORECASE)
    if z_match:
        z_val = float(z_match.group(1))
        n_val = float(z_match.group(2))
        return z_val / math.sqrt(z_val ** 2 + n_val)

    # Chi-squared: χ2(1, N = value) = value or x2(1, N = value) = value
    # Replace χ with x for matching
    normalized_stat = re.sub(r'^[χΧ]', 'x', stat_string)
    chi_match = re.match(r'^x2\(\s*1\s*,\s*n\s*=\s*(\d+)\s*\)\s*=\s*(\d+\.?\d*)$', normalized_stat, re.IGNORECASE)
    if chi_match:
        n_val = float(chi_match.group(1))
        chi_val = float(chi_match.group(2))
        return math.sqrt(chi_val / n_val)

    return None


def convert_effect_size(es_value, es_type, n1=None, n2=None):
    """
    Convert a single effect size to Pearson's r.

    Args:
        es_value: The effect size value (numeric or string for test statistics)
        es_type: The type of effect size (e.g., "d", "r", "or", "etasq")
        n1: Sample size for group 1 (optional, used for Cohen's d conversion)
        n2: Sample size for group 2 (optional, used for Cohen's d conversion)

    Returns:
        Pearson's r value, or None if conversion is not possible.
    """
    if es_value is None or es_type is None:
        return None

    # Handle pandas NA values
    if pd.isna(es_value) or pd.isna(es_type):
        return None

    # Normalize effect size type
    es_type_lower = str(es_type).lower().strip()

    # Replace curly apostrophes with straight ones
    es_type_lower = es_type_lower.replace("'", "'")

    # Check if this is a non-convertible type
    if es_type_lower in [t.lower() for t in CANNOT_CONVERT]:
        return None

    # Get canonical type
    canonical_type = ESTYPE_MAP.get(es_type_lower)

    if canonical_type is None:
        # Unknown type
        return None

    # Try to convert es_value to float (for non-test-statistic types)
    if canonical_type != "test-stat":
        try:
            es_value = float(es_value)
        except (ValueError, TypeError):
            return None

    # Perform conversion based on canonical type
    if canonical_type == "r":
        # Already r or phi, return as-is
        return es_value

    elif canonical_type == "r2":
        return r2_to_r(es_value)

    elif canonical_type == "d":
        return d_to_r(es_value, n1, n2)

    elif canonical_type == "or":
        return or_to_r(es_value)

    elif canonical_type == "eta2":
        return eta2_to_r(es_value)

    elif canonical_type == "f":
        return f_to_r(es_value)

    elif canonical_type == "f2":
        return f2_to_r(es_value)

    elif canonical_type == "test-stat":
        return parse_test_statistic(str(es_value))

    return None


def calculate_effect_sizes(df):
    """
    Calculate original_es_r and replication_es_r from effect size data.

    Only fills in values where:
    1. The target column (original_es_r or replication_es_r) is currently empty/missing
    2. All necessary source data is available (es value, es type, and N if needed for d)

    Args:
        df: DataFrame with effect size columns

    Returns:
        DataFrame with original_es_r and replication_es_r filled in where possible
    """
    print("\nCalculating effect sizes (converting to Pearson's r)...")

    # Ensure target columns exist
    if 'original_es_r' not in df.columns:
        df['original_es_r'] = None
    if 'replication_es_r' not in df.columns:
        df['replication_es_r'] = None

    original_filled = 0
    replication_filled = 0

    for idx, row in df.iterrows():
        # Process original effect size
        if is_empty(row.get('original_es_r')):
            original_es = row.get('original_es')
            original_es_type = row.get('original_es_type')
            original_n = row.get('original_n')

            if not is_empty(original_es) and not is_empty(original_es_type):
                # Get sample sizes for d conversion if available
                n1 = None
                n2 = None
                if not is_empty(original_n):
                    try:
                        # Assume equal groups if only total N is given
                        total_n = float(original_n)
                        n1 = total_n / 2
                        n2 = total_n / 2
                    except (ValueError, TypeError):
                        pass

                r_value = convert_effect_size(original_es, original_es_type, n1, n2)
                # Only store non-zero values (0 indicates failed conversion or meaningless data)
                if r_value is not None and r_value != 0:
                    df.at[idx, 'original_es_r'] = r_value
                    original_filled += 1

        # Process replication effect size
        if is_empty(row.get('replication_es_r')):
            replication_es = row.get('replication_es')
            replication_es_type = row.get('replication_es_type')
            replication_n = row.get('replication_n')

            if not is_empty(replication_es) and not is_empty(replication_es_type):
                # Get sample sizes for d conversion if available
                n1 = None
                n2 = None
                if not is_empty(replication_n):
                    try:
                        total_n = float(replication_n)
                        n1 = total_n / 2
                        n2 = total_n / 2
                    except (ValueError, TypeError):
                        pass

                r_value = convert_effect_size(replication_es, replication_es_type, n1, n2)
                # Only store non-zero values (0 indicates failed conversion or meaningless data)
                if r_value is not None and r_value != 0:
                    df.at[idx, 'replication_es_r'] = r_value
                    replication_filled += 1

    print(f"  ✓ Filled {original_filled} original_es_r values")
    print(f"  ✓ Filled {replication_filled} replication_es_r values")

    return df

def needs_enrichment(row, prefix):
    """Check if any key metadata fields are missing or abbreviated"""
    fields_to_check = ['authors', 'title', 'journal', 'volume', 'issue', 'pages', 'year']

    # Check if any field is missing or doesn't exist
    for field in fields_to_check:
        col_name = f"{prefix}_{field}"
        # Need enrichment if column doesn't exist OR if it's empty
        if col_name not in row.index or is_empty(row.get(col_name)):
            return True

    # Check if authors contains abbreviated names (single letter first names like "J.")
    authors = row.get(f"{prefix}_authors")
    if isinstance(authors, str) and authors.strip():
        # Check for pattern like "J. " or "M. " (abbreviated first names)
        if any(f" {c}. " in authors or authors.startswith(f"{c}. ") for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
            return True

    # Check if journal is highly abbreviated (less than 10 chars, likely abbreviated)
    journal = row.get(f"{prefix}_journal")
    if isinstance(journal, str) and len(journal.strip()) < 10 and "." in journal:
        return True

    return False

def enrich_from_metadata(row, prefix, metadata):
    """Fill row with metadata from API calls"""
    if not metadata:
        return row

    field_mapping = {
        'authors': f'{prefix}_authors',
        'title': f'{prefix}_title',
        'journal': f'{prefix}_journal',
        'volume': f'{prefix}_volume',
        'issue': f'{prefix}_issue',
        'pages': f'{prefix}_pages',
        'year': f'{prefix}_year',
    }

    for meta_key, col_name in field_mapping.items():
        # Fill if column doesn't exist or current value is empty
        if col_name not in row.index or is_empty(row.get(col_name)):
            if metadata.get(meta_key):
                row[col_name] = metadata[meta_key]

    return row

def sanity_check_metadata(row, prefix, metadata):
    """
    Check if fetched metadata matches existing data.
    Returns True if metadata is likely correct, False otherwise.
    Only checks the year field.
    """
    if not metadata:
        return False

    # Check year field only
    col_name = f"{prefix}_year"
    if col_name in row.index and not is_empty(row[col_name]):
        existing_value = str(row[col_name]).strip()
        fetched_value = str(metadata.get('year', "")).strip()

        print(fetched_value, existing_value)

        if fetched_value:
            # Handle float values like "2020.0" vs "2020"
            if existing_value.replace(".0", "") == fetched_value.replace(".0", ""):
                return True
            else:
                return False
    
    # If no year data to verify against, assume correct
    return True

def process_row(row, row_idx, total_rows, doi_cache=None):
    """Process a single row to enrich metadata"""
    if doi_cache is None:
        doi_cache = {}
    print(f"\nProcessing row {row_idx + 1}/{total_rows}...")

    # ===== PROCESS ORIGINAL STUDY =====
    original_url = row.get('original_url')
    original_doi = extract_doi_from_url(original_url)

    if original_doi and needs_enrichment(row, 'original'):
        if original_doi in doi_cache:
            print(f"  Using cached metadata for original DOI: {original_doi}")
            metadata = doi_cache[original_doi]
        else:
            print(f"  Fetching metadata for original DOI: {original_doi}")
            metadata = fetch_metadata_from_doi(original_doi)
            doi_cache[original_doi] = metadata
            time.sleep(0.3)  # Rate limiting
        row = enrich_from_metadata(row, 'original', metadata)

    # If no DOI URL but title exists, try to fetch DOI from title
    elif is_empty(original_url) and not is_empty(row.get('original_title')):
        print(f"  No original_url found, searching by title: {row.get('original_title')}...")
        metadata = fetch_metadata_from_title(row.get('original_title'))

        if metadata and metadata.get('doi'):
            # Sanity check the DOI
            if sanity_check_metadata(row, 'original', metadata):
                # Normalize DOI to handle cases where it's already a full URL
                normalized_doi = normalize_doi(metadata['doi'])
                if normalized_doi:
                    print(f"  ✓ Found and verified DOI: {normalized_doi}")
                    row['original_url'] = f"http://doi.org/{normalized_doi}"
                    row = enrich_from_metadata(row, 'original', metadata)
                else:
                    print(f"  ✗ Could not normalize DOI: {metadata['doi']}")
            else:
                print(f"  ✗ DOI failed sanity check, not using: {metadata['doi']}")
        else:
            print(f"  ✗ Could not find DOI from title")

        time.sleep(0.3)  # Rate limiting

    # ===== PROCESS REPLICATION STUDY =====
    replication_url = row.get('replication_url')
    replication_doi = extract_doi_from_url(replication_url)

    if replication_doi and needs_enrichment(row, 'replication'):
        if replication_doi in doi_cache:
            print(f"  Using cached metadata for replication DOI: {replication_doi}")
            metadata = doi_cache[replication_doi]
        else:
            print(f"  Fetching metadata for replication DOI: {replication_doi}")
            metadata = fetch_metadata_from_doi(replication_doi)
            doi_cache[replication_doi] = metadata
            time.sleep(0.3)  # Rate limiting
        row = enrich_from_metadata(row, 'replication', metadata)

    # If no DOI URL but title exists, try to fetch DOI from title
    elif is_empty(replication_url) and not is_empty(row.get('replication_title')):
        print(f"  No replication_url found, searching by title: {row.get('replication_title')[:50]}...")
        metadata = fetch_metadata_from_title(row.get('replication_title'))

        if metadata and metadata.get('doi'):
            # Sanity check the DOI
            if sanity_check_metadata(row, 'replication', metadata):
                # Normalize DOI to handle cases where it's already a full URL
                normalized_doi = normalize_doi(metadata['doi'])
                if normalized_doi:
                    print(f"  ✓ Found and verified DOI: {normalized_doi}")
                    row['replication_url'] = f"http://doi.org/{normalized_doi}"
                    row = enrich_from_metadata(row, 'replication', metadata)
                else:
                    print(f"  ✗ Could not normalize DOI: {metadata['doi']}")
            else:
                print(f"  ✗ DOI failed sanity check, not using: {metadata['doi']}")
        else:
            print(f"  ✗ Could not find DOI from title")

        time.sleep(0.3)  # Rate limiting

    return row

def generate_citations(df):
    """Generate HTML citations for display on website"""
    print("\nGenerating HTML citations...")

    # Extract DOI from URL for citation generation
    def get_doi_for_citation(url):
        doi = extract_doi_from_url(url)
        return doi if doi else ""

    df["replication_citation_html"] = df.apply(
        lambda row: generate_citation_html_for_website(
            row.get("replication_authors"),
            row.get("replication_journal"),
            row.get("replication_year"),
            get_doi_for_citation(row.get("replication_url")),
        ),
        axis=1
    )

    df["original_citation_html"] = df.apply(
        lambda row: generate_citation_html_for_website(
            row.get("original_authors"),
            row.get("original_journal"),
            row.get("original_year"),
            get_doi_for_citation(row.get("original_url")),
        ),
        axis=1
    )

    return df

def filter_columns(df, data_dict_path='data_dictionary.csv'):
    """Keep only columns that appear in data_dictionary.csv, preserving order from data dictionary"""
    print("\nFiltering columns based on data_dictionary.csv...")

    data_dict = pd.read_csv(data_dict_path)
    valid_columns = data_dict['column_name'].tolist()

    # Keep only columns that exist in both the dataframe and the valid columns list
    # Order them according to the order in data_dictionary.csv
    columns_to_keep = [col for col in valid_columns if col in df.columns]

    print(f"  Keeping {len(columns_to_keep)} valid columns out of {len(df.columns)} total")
    print(f"  Columns ordered according to data_dictionary.csv")

    return df[columns_to_keep]

def normalize_discipline_column(df):
    """Convert discipline column values to lowercase"""
    if 'discipline' in df.columns:
        print("\nNormalizing discipline column (converting to lowercase)...")
        df['discipline'] = df['discipline'].apply(
            lambda x: x.lower() if pd.notna(x) and isinstance(x, str) else x
        )
        print(f"  ✓ Converted discipline values to lowercase")
    return df

def reorder_columns(df, data_dict_path='data_dictionary.csv'):
    """Reorder columns according to the order in data_dictionary.csv"""
    data_dict = pd.read_csv(data_dict_path)
    valid_columns = data_dict['column_name'].tolist()
    
    # Get columns that exist in both the dataframe and the data dictionary
    # Order them according to the order in data_dictionary.csv
    columns_in_order = [col for col in valid_columns if col in df.columns]
    
    # Add any columns that exist in df but not in data dictionary (shouldn't happen after filtering, but just in case)
    remaining_columns = [col for col in df.columns if col not in columns_in_order]
    
    # Combine: ordered columns first, then any remaining columns
    final_column_order = columns_in_order + remaining_columns
    
    return df[final_column_order]

def check_duplicate(row, master_df):
    """
    Check if row is duplicate based on original_url, replication_url, and description.
    Returns True if duplicate found.
    """
    if master_df.empty:
        return False

    # Get values to check (handle different column names)
    original_check = row.get('original_url')
    replication_check = row.get('replication_url')
    description_check = row.get('description')

    # Check for exact match on all three fields
    matches = master_df[
        (master_df['original_url'] == original_check) &
        (master_df['replication_url'] == replication_check) &
        (master_df['description'] == description_check)
    ]

    return len(matches) > 0

def ingest_data(input_csv, skip_api_calls=False, discipline=None):
    """Main ingestion function"""
    print(f"\n{'='*60}")
    print(f"REPLICATIONS DATABASE INGESTION ENGINE")
    print(f"{'='*60}")
    if skip_api_calls:
        print("  [Skipping API calls - metadata enrichment disabled]")
    print(f"{'='*60}")

    # Load input data
    print(f"\nLoading input file: {input_csv}")
    input_df = pd.read_csv(input_csv)
    print(f"  Loaded {len(input_df)} rows")

    # Apply discipline to all rows if specified
    if discipline:
        input_df['discipline'] = discipline.lower()
        print(f"  Applied discipline '{discipline.lower()}' to all rows")

    # Find latest master database from version_history.txt
    latest_master = get_latest_master_database()
    if latest_master:
        master_csv = os.path.join(DATA_DIR, latest_master)
        print(f"\nLoading master database: {master_csv}")
        try:
            master_df = pd.read_csv(master_csv)
            print(f"  Loaded {len(master_df)} existing rows")
        except FileNotFoundError:
            print(f"  Master database not found at {master_csv}, will create new one")
            master_df = pd.DataFrame()
    else:
        print(f"\nNo master database found in version_history.txt, will create new one")
        master_df = pd.DataFrame()

    # Process each row (skip API calls if flag is set)
    if skip_api_calls:
        print(f"\n{'='*60}")
        print(f"STEP 1: SKIPPING METADATA ENRICHMENT (--skip-api-calls flag set)")
        print(f"{'='*60}")
        processed_df = input_df.copy()
    else:
        print(f"\n{'='*60}")
        print(f"STEP 1: ENRICHING METADATA")
        print(f"{'='*60}")

        doi_cache = {}  # Cache to avoid redundant API calls for same DOI
        processed_rows = []
        for idx, row in input_df.iterrows():
            processed_row = process_row(row, idx, len(input_df), doi_cache)
            processed_rows.append(processed_row)

        processed_df = pd.DataFrame(processed_rows)

    # Calculate effect sizes (convert to r)
    print(f"\n{'='*60}")
    print(f"STEP 2: CALCULATING EFFECT SIZES (converting to r)")
    print(f"{'='*60}")
    processed_df = calculate_effect_sizes(processed_df)

    # Generate citations
    print(f"\n{'='*60}")
    print(f"STEP 3: GENERATING CITATIONS HTML")
    print(f"{'='*60}")
    processed_df = generate_citations(processed_df)

    # Filter columns
    print(f"\n{'='*60}")
    print(f"STEP 4: FILTERING COLUMNS")
    print(f"{'='*60}")
    processed_df = filter_columns(processed_df)

    # Normalize discipline column
    processed_df = normalize_discipline_column(processed_df)

    # Check for duplicates and append
    print(f"\n{'='*60}")
    print(f"STEP 5: CHECKING DUPLICATES AND APPENDING")
    print(f"{'='*60}")

    rows_to_append = []
    duplicates_found = 0

    for idx, row in processed_df.iterrows():
        if check_duplicate(row, master_df):
            print(f"\n⚠️  WARNING: Row {idx + 1} is a duplicate (matching original_url, replication_url, and description)")
            print(f"    Original: {row.get('original_url')}")
            print(f"    Replication: {row.get('replication_url')}")
            print(f"    Description: {row.get('description', '')[:80]}...")
            duplicates_found += 1
        else:
            rows_to_append.append(row)

    print(f"\n  Found {duplicates_found} duplicates (skipped)")
    print(f"  Adding {len(rows_to_append)} new rows to master database")

    # Append new rows to master
    if rows_to_append:
        new_rows_df = pd.DataFrame(rows_to_append)
        # Set validated to "no" for any rows where it's empty
        if 'validated' in new_rows_df.columns:
            new_rows_df['validated'] = new_rows_df['validated'].apply(
                lambda x: 'no' if pd.isna(x) or x == '' or (isinstance(x, str) and not x.strip()) else x
            )
        else:
            new_rows_df['validated'] = 'no'
        updated_master_df = pd.concat([master_df, new_rows_df], ignore_index=True)
    else:
        updated_master_df = master_df

    # Calculate effect sizes for ALL rows (including existing ones that may be missing conversions)
    print(f"\n{'='*60}")
    print(f"STEP 5b: CALCULATING EFFECT SIZES FOR ALL ROWS")
    print(f"{'='*60}")
    updated_master_df = calculate_effect_sizes(updated_master_df)

    # Reorder columns according to data_dictionary.csv
    updated_master_df = reorder_columns(updated_master_df)

    # Save with timestamp
    print(f"\n{'='*60}")
    print(f"STEP 6: SAVING UPDATED DATABASE")
    print(f"{'='*60}")

    timestamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
    output_filename = f"replications_database_{timestamp}.csv"
    output_path = os.path.join(DATA_DIR, output_filename)
    updated_master_df.to_csv(output_path, index=False)
    print(f"\n✓ Saved updated database to: {output_path}")
    print(f"  Total rows in database: {len(updated_master_df)}")

    # Update version history
    print(f"\nUpdating {VERSION_HISTORY_PATH}...")
    # Ensure the file ends with a newline before appending
    with open(VERSION_HISTORY_PATH, 'r') as f:
        content = f.read()
    with open(VERSION_HISTORY_PATH, 'w') as f:
        # Strip trailing whitespace and ensure single newline at end
        f.write(content.rstrip() + '\n' + output_filename + '\n')
    print(f"✓ Added {output_filename} to version_history.txt")

    print(f"\n{'='*60}")
    print(f"INGESTION COMPLETE!")
    print(f"{'='*60}")
    print(f"Summary:")
    print(f"  - Input rows: {len(input_df)}")
    print(f"  - Duplicates skipped: {duplicates_found}")
    print(f"  - New rows added: {len(rows_to_append)}")
    print(f"  - Total rows in database: {len(updated_master_df)}")
    print(f"  - Output file: {output_path}")
    print()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingestion Engine for Replications Database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python data_ingestor.py cancer_biology_replications_data.csv --discipline "cancer biology"
  python data_ingestor.py --skip-api-calls psych_file_drawer_data_to_ingest.csv
        """
    )
    parser.add_argument('input_csv', help='Input CSV file to ingest')
    parser.add_argument('--skip-api-calls', action='store_true',
                       help='Skip metadata enrichment API calls (faster but no metadata updates)')
    parser.add_argument('--discipline', type=str, default=None,
                       help='Set discipline value for all rows (e.g., "cancer biology")')

    args = parser.parse_args()

    ingest_data(args.input_csv, skip_api_calls=args.skip_api_calls, discipline=args.discipline)
