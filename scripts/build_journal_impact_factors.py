#!/usr/bin/env python3
"""Build data/journal_impact_factors.json from the SciSciNet-v2 journals.db.

Joins the journals named in the current replications database CSV (the newest
one listed in data/version_history.txt) to per-year impact-factor metrics in
the SciSciNet dashboard's journals.db, and emits a compact JSON committed to
the repo so the website never needs the (offline, external-drive) database.

Each journal-year holds a 6-metric tuple
    [impact_factor_2yr, impact_factor_5yr, citescore,
     openalex_2yr_mean_citedness, scimago_sjr, scimago_cites_per_citable_doc_3yr]
The first three are SELF-COMPUTED from OpenAlex/SciSciNet-v2 citation data by the
metascience-observatory-explorer ETL (no document-type filtering) and must be
labeled "OpenAlex-derived". They differ from the official Clarivate JIF / Scopus
CiteScore in two ways that push OPPOSITE directions: the denominator counts every
document rather than only "citable items", which deflates, while the numerator
draws on a broader citation graph than Web of Science, which inflates. Deflation
usually wins - 85% of journals fall below the index-5 citable-denominator metric
(median ratio 0.80) - but 12% come out above it, so "systematically lower" is
wrong as a blanket claim. Note self-citations are NOT a difference: the standard
JIF includes them too. Index 3 is OpenAlex's own
published 2-year mean citedness (fetched live from the OpenAlex API; a single
current snapshot, so it populates only `recent`). Index 4 is the SCImago SJR for
that publication year (per-year CSVs; pre-1999 papers use the 1999 ranking).
Index 5 is a CiteScore-style metric = SCImago 'Total Citations (3years)' /
'Citable Docs. (3years)' for that year - unlike the self-computed IFs its
denominator is restricted to CITABLE documents, so it is normalized like the real
JIF/CiteScore and does not deflate high-front-matter journals (Nature/Science).

RE-RUN THIS SCRIPT whenever a new replications_database_*.csv version lands
(it only stores the journal/year pairs the CSV references). It is idempotent:
outputs are fully regenerated and deterministically ordered. OpenAlex responses
are cached to data/openalex_source_stats.json so re-runs don't re-fetch.

Usage:
    python3 scripts/build_journal_impact_factors.py \
        [--db-path /path/to/journals.db] [--repo-root /path/to/repo] \
        [--sjr-dir /path/to/scimago/csvs] [--no-openalex] [--refresh-openalex]

Outputs:
    data/journal_impact_factors.json      (committed; consumed by the website)
    data/openalex_source_stats.json       (committed cache of OpenAlex stats)
    scripts/journal_if_match_report.txt   (match/coverage report; committed)

Manual curation lives in scripts/journal_if_overrides.json:
    "overrides": exact original_journal string -> OpenAlex sourceid
    "denylist":  exact original_journal strings to skip (books, preprints,
                 conference proceedings - venues that have no impact factor)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

DEFAULT_DB_PATH = (
    "/media/dan/Seagate Portable Drive/"
    "sciscinet-dashboard_database_backup_01_29_2026/data/journals.db"
)

# Directory of per-year SCImago SJR CSVs named "scimagojr <year>.csv" (semicolon-
# delimited, decimal comma). Downloaded manually from scimagojr.com (Cloudflare
# blocks scripted download). SJR is non-commercial + attribution-required.
DEFAULT_SJR_DIR = "/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/sjrdata/csv_all_years"
SJR_MIN_YEAR = 1999  # earliest SJR CSV; papers older than this use the 1999 ranking

# Metric tuple order stored in the JSON, per journal-year and in `recent`:
#   [impact_factor_2yr, impact_factor_5yr, citescore, openalex_2yr_mean_citedness, scimago_sjr]
# The first three are self-computed from journals.db; index 3 is OpenAlex's own
# published 2-year mean citedness (a single current snapshot); index 4 is the
# SCImago SJR for that year (per-year, pre-1999 falls back to the 1999 value).
METRICS = (
    "impact_factor_2yr",
    "impact_factor_5yr",
    "citescore",
    "openalex_2yr_mean_citedness",
    "scimago_sjr",
    "scimago_cites_per_citable_doc_3yr",
)
N_METRICS = len(METRICS)
# A journal-year needs this many trailing years of citation data to be
# complete; used only to bound the "recent snapshot" year search.
SNAPSHOT_MIN_SHARE = 0.75  # snapshot year must cover >=75% of the best year's journal count
RECENT_MAX_LOOKBACK = 10   # how far below the snapshot year a journal's "recent" value may come from
AMBIGUITY_RATIO = 0.25     # log matches where runner-up has >25% of winner's total_papers


def strip_diacritics(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def normalize_light(s: str) -> str:
    s = strip_diacritics(s).lower()
    s = s.replace(".", " ").replace("&", " and ")
    return re.sub(r"\s+", " ", s).strip()


def normalize_aggressive(s: str) -> str:
    s = strip_diacritics(s).lower().replace("&", " and ")
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s.startswith("the "):
        s = s[4:]
    return s


def safe_subtitle_strip(s: str) -> str:
    """Strip NLM-style qualifiers only: ' : subtitle', trailing '(...)', trailing '...'.

    Never strips bare 'Word: Subtitle' (no space before the colon) - that would
    wrongly collapse series journals like 'Circulation: Cardiovascular Genetics'
    into their parent title.
    """
    s = re.sub(r"\s+:\s.*$", "", s)
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    s = re.sub(r"\s*\.\.\.\s*$", "", s)
    return s.strip()


def parse_year(value: str) -> int | None:
    try:
        y = int(float(value.strip()))
    except (ValueError, AttributeError):
        return None
    return y if 1500 <= y <= 2100 else None


def latest_csv_filename(repo_root: Path) -> str:
    lines = (repo_root / "data" / "version_history.txt").read_text().strip().split("\n")
    lines = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    return lines[-1].split("#")[0].strip()


def canonical_journal_key(name: str) -> str:
    """Case-insensitive, whitespace-collapsed key for grouping journal-name variants."""
    return " ".join(name.strip().lower().split())


def load_csv_corpus(csv_path: Path):
    """Return (journal -> set of years referenced, journal -> result-bearing row count, totals).

    Journal names that differ only in case/whitespace (e.g. "Nature Genetics"
    vs "Nature genetics") are merged into a single canonical entry so they do
    not emit duplicate JSON keys that split a journal's papers in the website.
    The best-cased, most-frequent spelling becomes the display name.
    """
    years_by_key: dict[str, set[int]] = defaultdict(set)
    result_rows_by_key: dict[str, int] = defaultdict(int)
    # Per key: {display spelling -> count} so we can choose a canonical spelling.
    spellings_by_key: dict[str, Counter] = defaultdict(Counter)
    total_rows = 0
    total_result_rows = 0
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            total_rows += 1
            result = (row.get("result") or "").lower()
            has_result = "success" in result or "failure" in result
            if has_result:
                total_result_rows += 1
            journal = (row.get("original_journal") or "").strip()
            if not journal:
                continue
            key = canonical_journal_key(journal)
            spellings_by_key[key][journal] += 1
            year = parse_year(row.get("original_year") or "")
            if year is not None:
                years_by_key[key].add(year)
            else:
                years_by_key[key]  # ensure key exists even without a year
            if has_result:
                result_rows_by_key[key] += 1

    # Re-key everything by the chosen display spelling (most uppercase letters,
    # then most frequent).
    def display_for(key: str) -> str:
        return max(
            spellings_by_key[key].items(),
            key=lambda kv: (sum(c.isupper() for c in kv[0]), kv[1]),
        )[0]

    years_by_journal: dict[str, set[int]] = {}
    result_rows_by_journal: dict[str, int] = defaultdict(int)
    for key, years in years_by_key.items():
        display = display_for(key)
        years_by_journal[display] = years
        result_rows_by_journal[display] = result_rows_by_key[key]
    return years_by_journal, result_rows_by_journal, total_rows, total_result_rows


def open_db_readonly(db_path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"{db_path.resolve().as_uri()}?mode=ro", uri=True)


def build_name_indexes(conn: sqlite3.Connection):
    """Build normalized-name -> best (sourceid, display_name, total_papers) dicts."""
    light: dict[str, tuple] = {}
    aggressive: dict[str, tuple] = {}
    ambiguities: list[str] = []
    all_names: list[tuple] = []  # (display_name, sourceid, total_papers) for near-miss search

    cur = conn.execute("SELECT sourceid, display_name, total_papers FROM journal_summary")
    for sourceid, display_name, total_papers in cur:
        if not display_name:
            continue
        papers = total_papers or 0
        all_names.append((display_name, sourceid, papers))
        for index, key in ((light, normalize_light(display_name)),
                           (aggressive, normalize_aggressive(display_name))):
            if not key:
                continue
            best = index.get(key)
            if best is None or papers > best[2]:
                if best is not None and best[2] > 0 and min(papers, best[2]) > AMBIGUITY_RATIO * max(papers, best[2]):
                    ambiguities.append(
                        f"  '{key}': kept {sourceid} ({display_name!r}, {papers} papers) over "
                        f"{best[0]} ({best[1]!r}, {best[2]} papers)"
                    )
                index[key] = (sourceid, display_name, papers)
            elif papers > 0 and papers > AMBIGUITY_RATIO * best[2]:
                ambiguities.append(
                    f"  '{key}': kept {best[0]} ({best[1]!r}, {best[2]} papers) over "
                    f"{sourceid} ({display_name!r}, {papers} papers)"
                )
    return light, aggressive, ambiguities, all_names


def match_journal(name: str, light_idx, aggressive_idx, overrides, denylist):
    """Return (sourceid, display_name, tier) or (None, None, 'unmatched'/'denylist')."""
    if name in denylist:
        return None, None, "denylist"
    if name in overrides:
        return overrides[name], None, "override"
    hit = light_idx.get(normalize_light(name))
    if hit:
        return hit[0], hit[1], "light"
    hit = aggressive_idx.get(normalize_aggressive(name))
    if hit:
        return hit[0], hit[1], "aggressive"
    stripped = safe_subtitle_strip(name)
    if stripped and stripped != name:
        hit = light_idx.get(normalize_light(stripped))
        if hit:
            return hit[0], hit[1], "subtitle+light"
        hit = aggressive_idx.get(normalize_aggressive(stripped))
        if hit:
            return hit[0], hit[1], "subtitle+aggressive"
    return None, None, "unmatched"


def load_if_rows(conn: sqlite3.Connection, sourceids: list[str]):
    """Return sourceid -> {year: (if2, if5, cs)}."""
    rows: dict[str, dict[int, tuple]] = defaultdict(dict)
    for i in range(0, len(sourceids), 500):
        chunk = sourceids[i : i + 500]
        placeholders = ",".join("?" * len(chunk))
        cur = conn.execute(
            f"SELECT sourceid, year, impact_factor_2yr, impact_factor_5yr, citescore "
            f"FROM journal_impact_factors WHERE sourceid IN ({placeholders})",
            chunk,
        )
        for sourceid, year, if2, if5, cs in cur:
            if year is not None:
                rows[sourceid][int(year)] = (if2, if5, cs)
    return rows


def norm_issn(s: str) -> str:
    """Normalize an ISSN to 8 chars, digits + trailing X, no dashes/spaces."""
    return re.sub(r"[^0-9X]", "", (s or "").upper())


def load_source_issns(conn: sqlite3.Connection, sourceids: list[str]) -> dict[str, list[str]]:
    """sourceid -> list of normalized ISSNs, from journal_summary.issn (JSON array string)."""
    out: dict[str, list[str]] = {}
    for i in range(0, len(sourceids), 500):
        chunk = sourceids[i : i + 500]
        placeholders = ",".join("?" * len(chunk))
        cur = conn.execute(
            f"SELECT sourceid, issn FROM journal_summary WHERE sourceid IN ({placeholders})",
            chunk,
        )
        for sourceid, issn_json in cur:
            issns: list[str] = []
            if issn_json:
                try:
                    for raw in json.loads(issn_json):
                        n = norm_issn(raw)
                        if len(n) == 8:
                            issns.append(n)
                except (json.JSONDecodeError, TypeError):
                    pass
            out[sourceid] = issns
    return out


def parse_sjr_value(raw: str):
    """SCImago SJR uses a decimal comma ('62,937' -> 62.937). Return float or None."""
    s = (raw or "").strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_sjr_by_year(sjr_dir: Path):
    """Return (issn -> {year: sjr}, name_key -> {year: sjr}, sorted list of years).

    Reads every 'scimagojr <year>.csv' in sjr_dir. Each is semicolon-delimited
    with a decimal comma. Journals are keyed by every ISSN they list (dashless)
    and, as a fallback, by aggressively-normalized Title.
    """
    issn_year: dict[str, dict[int, float]] = defaultdict(dict)
    name_year: dict[str, dict[int, float]] = defaultdict(dict)
    years: list[int] = []
    for path in sorted(sjr_dir.glob("scimagojr *.csv")):
        m = re.search(r"(\d{4})", path.name)
        if not m:
            continue
        year = int(m.group(1))
        years.append(year)
        with open(path, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                sjr = parse_sjr_value(row.get("SJR", ""))
                if sjr is None:
                    continue
                for issn in (row.get("Issn") or "").split(","):
                    n = norm_issn(issn)
                    if len(n) == 8:
                        # First (highest-SJR / first-listed) wins on rare dupes.
                        issn_year[n].setdefault(year, sjr)
                title = row.get("Title") or ""
                key = normalize_aggressive(title)
                if key:
                    name_year[key].setdefault(year, sjr)
    return issn_year, name_year, sorted(years)


def load_citescore_by_year(sjr_dir: Path):
    """Return (issn -> {year: ratio}, name_key -> {year: ratio}, sorted years).

    A CiteScore-style, citable-items-normalized metric computed from the same
    'scimagojr <year>.csv' files as the SJR:
        ratio = 'Total Citations (3years)' / 'Citable Docs. (3years)'
    SCImago's "Citable Docs" excludes non-citable front-matter, so unlike the
    self-computed IFs this is not deflated by news/editorials (Nature/Science).
    Keyed by every ISSN listed, with aggressively-normalized Title as fallback.
    """
    issn_year: dict[str, dict[int, float]] = defaultdict(dict)
    name_year: dict[str, dict[int, float]] = defaultdict(dict)
    years: list[int] = []
    for path in sorted(sjr_dir.glob("scimagojr *.csv")):
        m = re.search(r"(\d{4})", path.name)
        if not m:
            continue
        year = int(m.group(1))
        years.append(year)
        with open(path, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                cites = parse_sjr_value(row.get("Total Citations (3years)", ""))
                citable = parse_sjr_value(row.get("Citable Docs. (3years)", ""))
                if cites is None or not citable:  # None or 0 -> undefined ratio
                    continue
                ratio = cites / citable
                for issn in (row.get("Issn") or "").split(","):
                    n = norm_issn(issn)
                    if len(n) == 8:
                        issn_year[n].setdefault(year, ratio)
                key = normalize_aggressive(row.get("Title") or "")
                if key:
                    name_year[key].setdefault(year, ratio)
    return issn_year, name_year, sorted(years)


def parse_quartile(raw: str):
    """Map 'Q1'..'Q4' to 1..4 (1=best). '-' / blank / junk -> None."""
    s = (raw or "").strip().upper()
    if s in ("Q1", "Q2", "Q3", "Q4"):
        return int(s[1])
    return None


def parse_int(raw: str):
    try:
        return int(str(raw).strip())
    except (ValueError, TypeError):
        return None


def load_sjr_rank_by_year(sjr_dir: Path):
    """Return (issn -> {year: rankrec}, name_key -> {year: rankrec}, sorted years).

    rankrec = (percentile, quartile_int, raw_rank, h_index). Percentile is
    100*(1 - (rank-1)/N) where N is that year's count of validly-ranked journals,
    so it is comparable across years even though raw ranks are not (the number of
    ranked journals grows from ~17k (1999) to ~32k (2024)). Same ISSN/name keying
    as load_sjr_by_year.
    """
    issn_year: dict[str, dict[int, tuple]] = defaultdict(dict)
    name_year: dict[str, dict[int, tuple]] = defaultdict(dict)
    years: list[int] = []
    for path in sorted(sjr_dir.glob("scimagojr *.csv")):
        m = re.search(r"(\d{4})", path.name)
        if not m:
            continue
        year = int(m.group(1))
        # First pass: collect (row, rank) for validly-ranked journals to get N.
        parsed_rows = []
        with open(path, encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f, delimiter=";"):
                rank = parse_int(row.get("Rank"))
                if rank is not None and rank >= 1:
                    parsed_rows.append((row, rank))
        n_year = len(parsed_rows)
        if n_year == 0:
            continue
        years.append(year)
        for row, rank in parsed_rows:
            percentile = round(100.0 * (1.0 - (rank - 1) / n_year), 2)
            rec = (percentile, parse_quartile(row.get("SJR Best Quartile")),
                   rank, parse_int(row.get("H index")))
            for issn in (row.get("Issn") or "").split(","):
                n = norm_issn(issn)
                if len(n) == 8:
                    issn_year[n].setdefault(year, rec)  # first-listed wins on dupes
            key = normalize_aggressive(row.get("Title") or "")
            if key:
                name_year[key].setdefault(year, rec)
    return issn_year, name_year, sorted(years)


def sjr_for_year(per_year: dict[int, float], want_year: int, sjr_years: list[int]):
    """SJR for a paper published in want_year: exact year if present, else the
    nearest available year, clamped so pre-1999 uses the earliest (1999) ranking."""
    if not per_year:
        return None
    if want_year in per_year:
        return per_year[want_year]
    lo = sjr_years[0]
    target = max(want_year, lo)  # pre-1999 -> 1999
    # Nearest available year to `target` (prefer the closest; ties -> earlier).
    best = min(per_year.keys(), key=lambda y: (abs(y - target), y))
    return per_year[best]


def fetch_openalex_2yr(
    sourceids: list[str], cache_path: Path, api_key: str | None, refresh: bool
) -> dict[str, dict]:
    """sourceid -> {"oa2yr": float|None, "issn": [...], "fetched": ISO date}.

    Cached to cache_path; only missing (or --refresh) sourceids are fetched.
    Uses the OpenAlex polite pool (mailto) plus api_key when available.
    """
    cache: dict[str, dict] = {}
    if cache_path.exists():
        try:
            cache = json.loads(cache_path.read_text())
        except json.JSONDecodeError:
            cache = {}
    todo = [s for s in sourceids if refresh or s not in cache or cache[s].get("oa2yr") == "PENDING"]
    if todo:
        print(f"  Fetching OpenAlex 2yr_mean_citedness for {len(todo)} sources "
              f"({len(sourceids) - len(todo)} cached)...")
    for idx, sid in enumerate(todo, 1):
        params = {
            "select": "id,issn,issn_l,summary_stats",
            "mailto": "delton17@gmail.com",
        }
        if api_key:
            params["api_key"] = api_key
        url = f"https://api.openalex.org/sources/{sid}?" + urllib.parse.urlencode(params)
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            stats = data.get("summary_stats") or {}
            cache[sid] = {
                "oa2yr": stats.get("2yr_mean_citedness"),
                "issn": data.get("issn") or [],
                "fetched": date.today().isoformat(),
            }
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as e:
            print(f"    WARN {sid}: {e}")
            cache.setdefault(sid, {"oa2yr": None, "issn": [], "fetched": date.today().isoformat()})
        if idx % 100 == 0:
            print(f"    ...{idx}/{len(todo)}")
            cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=0) + "\n")
        time.sleep(0.11)  # polite pool: <10 req/s
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=0) + "\n")
    return cache


def pick_snapshot_year(if_rows: dict[str, dict[int, tuple]], max_year: int) -> int:
    """Latest year (<= max_year) where the count of journals with a non-null
    2yr IF is >= SNAPSHOT_MIN_SHARE of the best year's count. Re-runnable:
    automatically advances as newer complete years appear in the DB."""
    counts: dict[int, int] = defaultdict(int)
    for per_year in if_rows.values():
        for year, (if2, _if5, _cs) in per_year.items():
            if if2 is not None and year <= max_year:
                counts[year] += 1
    if not counts:
        raise SystemExit("No non-null impact_factor_2yr rows found - is journals.db populated?")
    best = max(counts.values())
    return max(y for y, c in counts.items() if c >= SNAPSHOT_MIN_SHARE * best)


def round1(v):
    return None if v is None else round(float(v), 1)


def round2(v):
    return None if v is None else round(float(v), 2)


def read_env_key(repo_root: Path) -> str | None:
    """Read OPENALEXAPIKEY from .env.local if not already in the environment."""
    env_path = repo_root / ".env.local"
    if not env_path.exists():
        return None
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line.startswith("OPENALEXAPIKEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'") or None
    return None


def find_near_misses(name: str, all_names, limit: int = 3) -> list[str]:
    key = normalize_light(name)
    if len(key) < 5:
        return []
    hits = [(papers, display) for display, _sid, papers in all_names
            if key in normalize_light(display) or normalize_light(display) in key]
    hits.sort(reverse=True)
    return [display for _papers, display in hits[:limit]]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--db-path", default=DEFAULT_DB_PATH)
    parser.add_argument("--repo-root", default=str(Path(__file__).resolve().parent.parent))
    parser.add_argument("--sjr-dir", default=DEFAULT_SJR_DIR,
                        help="directory of per-year 'scimagojr <year>.csv' files")
    parser.add_argument("--no-openalex", action="store_true",
                        help="skip the OpenAlex 2yr_mean_citedness fetch (use cache only)")
    parser.add_argument("--refresh-openalex", action="store_true",
                        help="re-fetch every OpenAlex source even if cached")
    args = parser.parse_args()

    repo_root = Path(args.repo_root)
    db_path = Path(args.db_path)
    if not db_path.exists():
        sys.exit(f"journals.db not found at {db_path} - attach the drive or pass --db-path")

    overrides_path = repo_root / "scripts" / "journal_if_overrides.json"
    curation = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    overrides = curation.get("overrides", {})
    denylist = set(curation.get("denylist", []))

    csv_name = latest_csv_filename(repo_root)
    csv_path = repo_root / "data" / csv_name
    print(f"CSV: {csv_name}")
    years_by_journal, result_rows_by_journal, total_rows, total_result_rows = load_csv_corpus(csv_path)
    print(f"  {total_rows} rows, {total_result_rows} with success/failure result, "
          f"{len(years_by_journal)} unique journals")

    conn = open_db_readonly(db_path)
    print("Loading journal_summary name indexes...")
    light_idx, aggressive_idx, ambiguities, all_names = build_name_indexes(conn)

    matches: dict[str, tuple] = {}   # name -> (sourceid, db_display_name, tier)
    tier_counts: dict[str, int] = defaultdict(int)
    for name in years_by_journal:
        sourceid, display, tier = match_journal(name, light_idx, aggressive_idx, overrides, denylist)
        tier_counts[tier] += 1
        if sourceid:
            matches[name] = (sourceid, display, tier)

    matched_rows = sum(result_rows_by_journal.get(n, 0) for n in matches)
    journal_rows = sum(result_rows_by_journal.values())
    print(f"Matched {len(matches)}/{len(years_by_journal)} journal names "
          f"({matched_rows}/{journal_rows} result-bearing rows with a journal)")

    sourceids = sorted({sid for sid, _d, _t in matches.values()})
    print(f"Loading impact-factor rows for {len(sourceids)} journals...")
    if_rows = load_if_rows(conn, sourceids)
    print("Loading journal ISSNs (for the SCImago SJR join)...")
    source_issns = load_source_issns(conn, sourceids)
    conn.close()

    # ---- OpenAlex 2yr_mean_citedness (index 3; snapshot only) ------------
    oa_cache_path = repo_root / "data" / "openalex_source_stats.json"
    api_key = os.environ.get("OPENALEXAPIKEY") or read_env_key(repo_root)
    if args.no_openalex:
        print("Skipping OpenAlex fetch (--no-openalex); using cache if present.")
        oa_stats = json.loads(oa_cache_path.read_text()) if oa_cache_path.exists() else {}
    else:
        print("Fetching OpenAlex 2yr_mean_citedness...")
        oa_stats = fetch_openalex_2yr(sourceids, oa_cache_path, api_key, args.refresh_openalex)
    oa2yr_by_sid = {sid: (v.get("oa2yr") if isinstance(v.get("oa2yr"), (int, float)) else None)
                    for sid, v in oa_stats.items()}

    # ---- SCImago SJR (index 4) + citable-doc CiteScore (index 5) --------
    sjr_dir = Path(args.sjr_dir)
    if sjr_dir.exists():
        print(f"Loading SCImago SJR CSVs from {sjr_dir}...")
        sjr_issn, sjr_name, sjr_years = load_sjr_by_year(sjr_dir)
        print(f"  {len(sjr_years)} SJR years ({sjr_years[0]}-{sjr_years[-1]}), "
              f"{len(sjr_issn)} ISSNs indexed")
        print("Loading SCImago citable-doc CiteScore (Total Citations 3yr / Citable Docs 3yr)...")
        cs_issn, cs_name, cs_years = load_citescore_by_year(sjr_dir)
        print(f"  {len(cs_years)} CiteScore years, {len(cs_issn)} ISSNs indexed")
        print("Loading SCImago rank/quartile/h-index...")
        rank_issn, rank_name, rank_years = load_sjr_rank_by_year(sjr_dir)
    else:
        print(f"WARN: SJR dir {sjr_dir} not found - SJR/CiteScore/rank metrics will be empty.")
        sjr_issn, sjr_name, sjr_years = {}, {}, []
        cs_issn, cs_name, cs_years = {}, {}, []
        rank_issn, rank_name, rank_years = {}, {}, []

    def _series_for(issn_idx, name_idx, sourceid: str, name: str) -> dict:
        """Per-year {year: value} for a journal, matched by ISSN then aggressive name."""
        merged: dict = {}
        for issn in source_issns.get(sourceid, []):
            per = issn_idx.get(issn)
            if per:
                for y, v in per.items():
                    merged.setdefault(y, v)
        if not merged:
            per = name_idx.get(normalize_aggressive(name))
            if per:
                merged.update(per)
        return merged

    def sjr_series_for(sourceid: str, name: str) -> dict[int, float]:
        return _series_for(sjr_issn, sjr_name, sourceid, name)

    def citescore_series_for(sourceid: str, name: str) -> dict[int, float]:
        return _series_for(cs_issn, cs_name, sourceid, name)

    snapshot_year = pick_snapshot_year(if_rows, max_year=date.today().year)
    print(f"Snapshot year: {snapshot_year}")

    journals_out: dict[str, dict] = {}
    exact_year_rows = 0
    sjr_matched = 0
    oa_matched = 0
    cs_matched = 0
    for name, (sourceid, _display, _tier) in matches.items():
        per_year = if_rows.get(sourceid, {})
        oa2yr = round1(oa2yr_by_sid.get(sourceid))
        sjr_series = sjr_series_for(sourceid, name)
        cs_series = citescore_series_for(sourceid, name)
        if sjr_series:
            sjr_matched += 1
        if oa2yr is not None:
            oa_matched += 1
        if cs_series:
            cs_matched += 1

        # Union of years we need entries for: any referenced pub-year, plus every
        # year the self-computed IF has data. Each tuple is length N_METRICS.
        by_year: dict[str, list] = {}
        candidate_years = set(years_by_journal[name]) | set(per_year.keys())
        for year in sorted(candidate_years):
            vals = per_year.get(year)  # (if2, if5, cs) or None
            if3 = [round1(v) for v in vals] if vals else [None, None, None]
            sjr_v = round2(sjr_for_year(sjr_series, year, sjr_years)) if sjr_series else None
            # citable-doc CiteScore, per publication year (pre-1999 -> 1999, like SJR).
            cs_v = round1(sjr_for_year(cs_series, year, cs_years)) if cs_series else None
            # oa2yr is a single snapshot; store it on every year entry so pub-year
            # basis has a value to show (it does not vary by year in OpenAlex).
            tuple6 = [if3[0], if3[1], if3[2], oa2yr, sjr_v, cs_v]
            if any(v is not None for v in tuple6):
                by_year[str(year)] = tuple6

        # Recent snapshot: latest year <= snapshot_year with a non-null 2yr IF.
        recent, recent_year = None, None
        for year in range(snapshot_year, snapshot_year - RECENT_MAX_LOOKBACK, -1):
            vals = per_year.get(year)
            if vals and vals[0] is not None:
                recent = [round1(vals[0]), round1(vals[1]), round1(vals[2])]
                recent_year = year
                break
        # Fill SJR/OA/CiteScore into the recent tuple even if the IF snapshot is missing.
        recent_sjr = round2(sjr_series[max(sjr_series)]) if sjr_series else None
        recent_cs = round1(cs_series[max(cs_series)]) if cs_series else None
        if recent is None and (oa2yr is not None or recent_sjr is not None or recent_cs is not None):
            recent = [None, None, None]
        if recent is not None:
            recent = recent + [oa2yr, recent_sjr, recent_cs]

        if not by_year and recent is None:
            continue  # matched but no usable data of any kind: omit
        journals_out[name] = {
            "sid": sourceid,
            "recentYear": recent_year,
            "recent": recent,
            "byYear": by_year,
        }
        exact_year_rows += result_rows_by_journal.get(name, 0) if by_year else 0

    out = {
        "_meta": {
            "generated": date.today().isoformat(),
            "source": ("SciSciNet-v2/OpenAlex self-computed IF + OpenAlex 2yr_mean_citedness "
                       "+ SCImago SJR + SCImago citable-doc CiteScore"),
            "note": ("Metric order [if2,if5,citescore,openalex_2yr_mean_citedness,scimago_sjr,"
                     "scimago_cites_per_citable_doc_3yr]. The first three are self-computed (no "
                     "doc-type filtering / self-citation exclusion), systematically lower than "
                     "Clarivate JIF - not Journal Impact Factor(TM). Index 3 is OpenAlex's published "
                     "2-year mean citedness (current snapshot). Index 4 is SCImago SJR for the "
                     "publication year (pre-1999 uses 1999). Index 5 is a CiteScore-style metric = "
                     "SCImago 'Total Citations (3years)' / 'Citable Docs. (3years)' per publication "
                     "year (pre-1999 uses 1999); its citable-doc denominator normalizes like the real "
                     "JIF/CiteScore, so it does NOT deflate high-front-matter journals."),
            "attribution": ("SCImago SJR data: SCImago, (n.d.). SJR - SCImago Journal & Country Rank "
                            "[Portal]. Retrieved from https://www.scimagojr.com - used non-commercially."),
            "csv": csv_name,
            "snapshotYear": snapshot_year,
            "metrics": list(METRICS),
        },
        "journals": {name: journals_out[name] for name in sorted(journals_out)},
    }
    out_path = repo_root / "data" / "journal_impact_factors.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {out_path} ({out_path.stat().st_size / 1024:.0f} KB, {len(journals_out)} journals)")

    # ---- Journal-rank JSON (percentile / quartile / rank / h-index) ------
    # Same {sid, recentYear, recent, byYear} shape as above, but each tuple is
    # [sjr_percentile, sjr_quartile(1-4), sjr_rank, h_index]. Percentile/quartile/
    # rank are per publication year (pre-1999 -> 1999); h-index is a snapshot
    # (constant across years in this data) stored on every entry + recent.
    rank_out: dict[str, dict] = {}
    rank_matched = 0
    for name, (sourceid, _display, _tier) in matches.items():
        series = _series_for(rank_issn, rank_name, sourceid, name)
        if not series:
            continue
        rank_matched += 1
        # h-index is snapshot: take the most recent year's value.
        latest_rec = series[max(series)]
        h_index = latest_rec[3]
        by_year: dict[str, list] = {}
        candidate_years = sorted(set(years_by_journal[name]) | set(series.keys()))
        for year in candidate_years:
            rec = sjr_for_year(series, year, rank_years)  # (pct, q, rank, h) or None
            if rec is None:
                continue
            pct, q, rnk, _h = rec
            tup = [pct, q, rnk, h_index]
            if any(v is not None for v in tup):
                by_year[str(year)] = tup
        latest_year = max(series)
        latest = series[latest_year]
        recent = [latest[0], latest[1], latest[2], h_index]
        if not by_year and all(v is None for v in recent):
            continue
        rank_out[name] = {
            "sid": sourceid,
            "recentYear": latest_year,
            "recent": recent,
            "byYear": by_year,
        }

    rank_json = {
        "_meta": {
            "generated": date.today().isoformat(),
            "source": "SCImago Journal Rank (SJR) - overall rank, best-quartile, and journal h-index",
            "note": ("Metric order [sjr_percentile, sjr_quartile, sjr_rank, h_index]. Percentile = "
                     "100*(1-(rank-1)/N) over that year's N ranked journals, so it is comparable "
                     "across years (raw rank is not: ~17k journals in 1999 grew to ~32k by 2024). "
                     "Quartile is 1-4 (1=Q1, best). Rank/percentile/quartile are per publication "
                     "year (pre-1999 uses 1999); h-index is a per-journal snapshot on every entry."),
            "attribution": ("SCImago (n.d.). SJR - SCImago Journal & Country Rank [Portal]. "
                            "Retrieved from https://www.scimagojr.com - used non-commercially."),
            "csv": csv_name,
            "snapshotYear": rank_years[-1] if rank_years else None,
            "metrics": ["sjr_percentile", "sjr_quartile", "sjr_rank", "h_index"],
        },
        "journals": {name: rank_out[name] for name in sorted(rank_out)},
    }
    rank_path = repo_root / "data" / "journal_rank_metrics.json"
    rank_path.write_text(json.dumps(rank_json, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {rank_path} ({rank_path.stat().st_size / 1024:.0f} KB, {len(rank_out)} journals; "
          f"{rank_matched} rank-matched)")

    # ---- Match report ---------------------------------------------------
    unmatched = sorted(
        (n for n in years_by_journal if n not in matches and n not in denylist),
        key=lambda n: -result_rows_by_journal.get(n, 0),
    )
    report = []
    report.append(f"journal_impact_factors match report - generated {date.today().isoformat()}")
    report.append(f"CSV: {csv_name}")
    report.append("")
    report.append(f"Unique journal names: {len(years_by_journal)}")
    report.append("Match tiers: " + ", ".join(f"{t}={c}" for t, c in sorted(tier_counts.items())))
    report.append(f"Matched names: {len(matches)} ({100 * len(matches) / len(years_by_journal):.1f}%)")
    report.append(f"Result-bearing rows total: {total_result_rows}; with a journal: {journal_rows}")
    report.append(f"  on a matched journal: {matched_rows} ({100 * matched_rows / journal_rows:.1f}%)")
    per_year_hits = 0
    for name, entry in journals_out.items():
        wanted = {str(y) for y in years_by_journal[name]}
        if wanted & set(entry["byYear"]):
            per_year_hits += result_rows_by_journal.get(name, 0)
    report.append(f"  on a journal with >=1 exact publication-year IF: {per_year_hits} "
                  f"({100 * per_year_hits / journal_rows:.1f}%)")
    report.append(f"Journals emitted: {len(journals_out)}; snapshot year: {snapshot_year}")
    report.append("")
    n_emit = max(len(journals_out), 1)
    report.append("External metric coverage (of emitted journals):")
    report.append(f"  OpenAlex 2yr_mean_citedness: {oa_matched} ({100 * oa_matched / n_emit:.1f}%)")
    report.append(f"  SCImago SJR (>=1 year matched): {sjr_matched} ({100 * sjr_matched / n_emit:.1f}%)")
    report.append(f"  SCImago citable-doc CiteScore (>=1 year matched): {cs_matched} "
                  f"({100 * cs_matched / n_emit:.1f}%)")
    report.append(f"  SCImago rank/quartile/h-index (journals emitted to rank JSON): {len(rank_out)}")
    if sjr_years:
        report.append(f"  SJR CSV year range: {sjr_years[0]}-{sjr_years[-1]} ({len(sjr_years)} files)")
    report.append("")
    report.append(f"Denylisted: {len(denylist)}; overrides: {len(overrides)}")
    report.append("")
    report.append(f"UNMATCHED NAMES ({len(unmatched)}), sorted by result-bearing row count.")
    report.append("Add high-count real journals to scripts/journal_if_overrides.json 'overrides';")
    report.append("add books/preprints/conference venues to 'denylist'.")
    for name in unmatched:
        rows_n = result_rows_by_journal.get(name, 0)
        suggestions = find_near_misses(name, all_names)
        line = f"  [{rows_n:4d} rows] {name}"
        if suggestions:
            line += "  | near: " + " ;; ".join(suggestions)
        report.append(line)
    if ambiguities:
        report.append("")
        report.append(f"AMBIGUOUS NORMALIZED NAMES (runner-up >{int(AMBIGUITY_RATIO * 100)}% of winner) "
                      f"- first {min(len(ambiguities), 200)} shown:")
        report.extend(ambiguities[:200])
    report_path = repo_root / "scripts" / "journal_if_match_report.txt"
    report_path.write_text("\n".join(report) + "\n")
    print(f"Wrote {report_path}")
    print(f"Top unmatched: {[n for n in unmatched[:8]]}")


if __name__ == "__main__":
    main()
