#!/usr/bin/env python3
"""
Fill missing original_url (DOI) fields using Semantic Scholar API.

For rows missing original_url but having original_title + (year or authors),
queries Semantic Scholar and validates matches before updating.

Usage:
    python fill_missing_original_urls.py --dry-run  # Preview changes
    python fill_missing_original_urls.py            # Apply changes
"""

import csv
import sys
import logging
import argparse
import time
from pathlib import Path
from difflib import SequenceMatcher
import requests

# Add parent directory to path to import helpers
sys.path.insert(0, str(Path(__file__).parent))
from fetch_metadata_from_title import _get_env_key, _request_with_retry

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

SEMANTIC_SCHOLAR_API_KEY = _get_env_key('SEMANTIC_SCHOLAR_API_KEY')
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'

# Validation thresholds
TITLE_SIMILARITY_THRESHOLD = 0.85  # High threshold for safety
YEAR_TOLERANCE = 1  # Allow ±1 year difference


def normalize_title(title):
    """Normalize title for comparison: lowercase, strip punctuation."""
    if not title:
        return ""
    import re
    # Remove punctuation, extra whitespace, normalize
    t = title.lower().strip()
    t = re.sub(r'[^\w\s]', ' ', t)  # Replace punctuation with space
    t = re.sub(r'\s+', ' ', t).strip()  # Normalize whitespace
    return t


def title_similarity(title1, title2):
    """Calculate similarity score (0-1) between two titles."""
    if not title1 or not title2:
        return 0.0
    t1 = normalize_title(title1)
    t2 = normalize_title(title2)
    return SequenceMatcher(None, t1, t2).ratio()


def author_overlap(authors1_str, authors2_list):
    """
    Calculate author overlap score (0-1).

    Args:
        authors1_str: Semicolon-separated author string from CSV
        authors2_list: List of author dicts from Semantic Scholar [{"name": "..."}]

    Returns:
        Fraction of authors that match (normalized by last name)
    """
    if not authors1_str or not authors2_list:
        return 0.0

    # Extract last names from CSV authors
    csv_authors = [a.strip() for a in authors1_str.split(';') if a.strip()]
    csv_last_names = set()
    for author in csv_authors:
        # Handle "LastName, FirstName" or "FirstName LastName"
        parts = author.split(',')
        if len(parts) > 1:
            # "LastName, FirstName" format
            csv_last_names.add(normalize_title(parts[0].strip()))
        else:
            # "FirstName LastName" format - take last word
            words = author.strip().split()
            if words:
                csv_last_names.add(normalize_title(words[-1]))

    # Extract last names from Semantic Scholar authors
    s2_last_names = set()
    for author in authors2_list:
        name = author.get('name', '')
        words = name.strip().split()
        if words:
            s2_last_names.add(normalize_title(words[-1]))

    if not csv_last_names or not s2_last_names:
        return 0.0

    # Calculate Jaccard similarity
    intersection = len(csv_last_names & s2_last_names)
    union = len(csv_last_names | s2_last_names)
    return intersection / union if union > 0 else 0.0


def query_semantic_scholar(title, year=None, authors=None):
    """
    Query Semantic Scholar for a paper by title.

    Returns:
        dict with keys: doi, s2_title, s2_year, s2_authors, s2_venue, confidence
        or None if no good match found
    """
    import urllib.parse

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/117.0.0.0"
    }
    if SEMANTIC_SCHOLAR_API_KEY:
        headers['x-api-key'] = SEMANTIC_SCHOLAR_API_KEY

    # Search by title
    q = urllib.parse.quote(title)
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={q}&limit=3&fields=title,year,venue,authors,externalIds"

    try:
        r = _request_with_retry(url, headers=headers, max_retries=2, timeout=10)
        if not r or r.status_code != 200:
            logger.warning(f"Semantic Scholar returned HTTP {r.status_code if r else 'None'}")
            return None

        data = r.json()
        results = data.get('data', [])

        if not results:
            logger.debug(f"No results for title: {title[:60]}")
            return None

        # Evaluate each result
        best_match = None
        best_score = 0.0

        for result in results[:3]:  # Check top 3 results
            s2_title = result.get('title', '')
            s2_year = result.get('year')
            s2_authors = result.get('authors', [])
            ext_ids = result.get('externalIds', {}) or {}
            s2_doi = ext_ids.get('DOI', '')
            s2_venue = result.get('venue', '')

            # Skip if no DOI
            if not s2_doi:
                continue

            # Calculate confidence score
            title_sim = title_similarity(title, s2_title)

            # Title must meet minimum threshold
            if title_sim < TITLE_SIMILARITY_THRESHOLD:
                continue

            score = title_sim

            # Bonus for year match (if year provided)
            year_match = False
            if year and s2_year:
                try:
                    year_diff = abs(int(year) - int(s2_year))
                    if year_diff <= YEAR_TOLERANCE:
                        score += 0.1
                        year_match = True
                    else:
                        # Penalize year mismatch
                        score -= 0.2
                except (ValueError, TypeError):
                    pass

            # Bonus for author overlap (if authors provided)
            author_match = False
            if authors and s2_authors:
                author_sim = author_overlap(authors, s2_authors)
                if author_sim > 0.3:  # At least 30% overlap
                    score += author_sim * 0.2
                    author_match = True

            if score > best_score:
                best_score = score
                best_match = {
                    'doi': s2_doi,
                    's2_title': s2_title,
                    's2_year': s2_year,
                    's2_authors': s2_authors,
                    's2_venue': s2_venue,
                    'confidence': score,
                    'title_similarity': title_sim,
                    'year_match': year_match,
                    'author_match': author_match,
                }

        return best_match

    except Exception as e:
        logger.warning(f"Error querying Semantic Scholar: {e}")
        return None


def get_latest_database_path():
    """Get path to the latest database file from version_history.txt."""
    version_file = DATA_DIR / 'version_history.txt'
    with open(version_file) as f:
        lines = [l.strip() for l in f if l.strip() and not l.strip().startswith('#')]
    filename = lines[-1].split('#')[0].strip()
    return DATA_DIR / filename


def main():
    parser = argparse.ArgumentParser(description='Fill missing original_url fields using Semantic Scholar')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without writing')
    parser.add_argument('--min-confidence', type=float, default=0.85, help='Minimum confidence score (default: 0.85)')
    parser.add_argument('--limit', type=int, help='Limit number of rows to process (for testing)')
    args = parser.parse_args()

    # Load database
    db_path = get_latest_database_path()
    logger.info(f"Loading database: {db_path.name}")

    with open(db_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    logger.info(f"Total rows: {len(rows)}")

    # Find rows missing original_url but with title
    candidates = [
        r for r in rows
        if not r.get('original_url', '').strip()
        and r.get('original_title', '').strip()
    ]

    logger.info(f"Found {len(candidates)} rows missing original_url with title available")

    if args.limit:
        candidates = candidates[:args.limit]
        logger.info(f"Limited to {len(candidates)} rows for testing")

    # Process each candidate
    updates = []
    for i, row in enumerate(candidates, 1):
        title = row.get('original_title', '').strip()
        year = row.get('original_year', '').strip()
        authors = row.get('original_authors', '').strip()

        logger.info(f"\n[{i}/{len(candidates)}] Searching for: {title[:70]}")

        # Query Semantic Scholar
        match = query_semantic_scholar(title, year, authors)

        if not match:
            logger.info("  ❌ No match found")
            continue

        if match['confidence'] < args.min_confidence:
            logger.info(f"  ⚠️  Low confidence ({match['confidence']:.2f} < {args.min_confidence})")
            logger.info(f"     Found: {match['s2_title'][:70]}")
            continue

        # Log match details
        logger.info(f"  ✅ Match found (confidence: {match['confidence']:.2f})")
        logger.info(f"     DOI: {match['doi']}")
        logger.info(f"     Title similarity: {match['title_similarity']:.2f}")
        logger.info(f"     S2 title: {match['s2_title'][:70]}")
        if year and match['s2_year']:
            year_icon = "✓" if match['year_match'] else "✗"
            logger.info(f"     Year: {year} vs {match['s2_year']} {year_icon}")
        if authors and match['s2_authors']:
            author_icon = "✓" if match['author_match'] else "✗"
            s2_authors_str = '; '.join(a['name'] for a in match['s2_authors'][:3])
            logger.info(f"     Authors: {author_icon}")
            logger.info(f"       CSV: {authors[:70]}")
            logger.info(f"       S2:  {s2_authors_str[:70]}")

        updates.append({
            'row': row,
            'doi': match['doi'],
            'match_info': match
        })

        # Rate limiting
        time.sleep(0.5)

    # Summary
    logger.info(f"\n{'='*70}")
    logger.info(f"SUMMARY: Found {len(updates)} DOIs to add")

    if not updates:
        logger.info("No updates to apply.")
        return

    if args.dry_run:
        logger.info("\n🔍 DRY RUN - No changes written to database")
        logger.info("\nPreview of updates:")
        for u in updates[:10]:  # Show first 10
            logger.info(f"  • {u['row'].get('original_title', '')[:60]}")
            logger.info(f"    → {u['doi']}")
        if len(updates) > 10:
            logger.info(f"  ... and {len(updates) - 10} more")
        return

    # Apply updates
    logger.info("\n✏️  Applying updates to database...")
    for update in updates:
        update['row']['original_url'] = update['doi']

    # Write updated database
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y_%m_%d_%H%M%S')
    output_path = DATA_DIR / f"replications_database_{timestamp}.csv"

    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    logger.info(f"✅ Updated database written to: {output_path.name}")
    logger.info(f"   Added {len(updates)} DOIs")

    # Update version history
    version_file = DATA_DIR / 'version_history.txt'
    with open(version_file, 'a') as f:
        f.write(f"{output_path.name}  # Added {len(updates)} missing original_url DOIs via Semantic Scholar\n")

    logger.info(f"✅ Updated version_history.txt")


if __name__ == '__main__':
    main()
