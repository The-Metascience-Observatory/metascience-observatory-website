#!/usr/bin/env python3
"""Build data/original_paper_h_index.json from the SciSciNet dashboard SQLite backup.

For every unique original-paper DOI in the current replications database CSV
(the newest one listed in data/version_history.txt), looks up the paper's
authors and their h-indexes in the sciscinet-dashboard journals.db (derived
from SciSciNet-v2, which is derived from OpenAlex), and emits a compact JSON
committed to the repo so the website never touches the 1.5 TB database at
runtime.

Used by app/replications-database/by-h-index/ to plot replication rate
against the h-index of the original paper's authors (mean / max / first /
last author).

NOTE: h-indexes are the authors' CURRENT values as of the SciSciNet/OpenAlex
snapshot, not their values when the original paper was published. The page
states this caveat; a contemporaneous (at-publication) variant could be
computed from person_publications + paper_citations but is a much longer job.

RE-RUN THIS SCRIPT whenever a new replications_database_*.csv version lands
(requires the backup drive to be mounted).

Usage:
    python3 scripts/build_author_h_index.py \
        [--repo-root /path/to/repo] [--db /path/to/journals.db]

Outputs:
    data/original_paper_h_index.json     (committed; consumed by the website)
    scripts/h_index_match_report.txt     (match/coverage report; committed)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import statistics
import sys
import time
from datetime import date
from pathlib import Path

DEFAULT_DB = (
    "/media/dan/Seagate Portable Drive/"
    "sciscinet-dashboard_database_backup_01_29_2026/data/journals.db"
)
# The date embedded in the backup directory name; recorded in _meta so the
# page can say how stale the h-indexes are.
DB_SNAPSHOT = "2026-01-29"


def latest_csv_filename(repo_root: Path) -> str:
    lines = (repo_root / "data" / "version_history.txt").read_text().strip().split("\n")
    lines = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    return lines[-1].split("#")[0].strip()


def normalize_doi_url(raw: str) -> str | None:
    """Canonicalize a CSV original_url to https://doi.org/<lowercased doi>.
    Identical to build_original_paper_citations.py (and paper_summary.doi in
    the SciSciNet db uses the same form)."""
    s = raw.strip().lower()
    if not s:
        return None
    m = re.search(r"doi\.org/(.+)$", s)
    if not m:
        return None
    doi = m.group(1).strip().strip("/")
    if not doi.startswith("10."):
        return None
    return f"https://doi.org/{doi}"


def paper_h_indexes(cur: sqlite3.Cursor, doi: str) -> dict | None:
    """One paper's author h-index record, or None if the DOI isn't in the db.

    Returns {"a": [h,...] in author order (first, middles, last),
             "f": first-author h or None, "l": last-author h or None}.
    Authors without a person_summary row (or a null h_index) are dropped from
    "a"; "f"/"l" are None when that positional author has no h-index.
    """
    row = cur.execute(
        "SELECT paperid FROM paper_summary WHERE doi = ? LIMIT 1", (doi,)
    ).fetchone()
    if row is None:
        return None
    authors = cur.execute(
        """
        SELECT pa.author_position, ps.h_index
        FROM paper_authors pa
        LEFT JOIN person_summary ps ON ps.authorid = pa.authorid
        WHERE pa.paperid = ?
        """,
        (row[0],),
    ).fetchall()
    if not authors:
        return {"a": [], "f": None, "l": None}
    # Preserve first < middle < last ordering; middles keep their query order.
    pos_rank = {"first": 0, "middle": 1, "last": 2}
    ordered = sorted(authors, key=lambda a: pos_rank.get(a[0] or "", 1))
    hs = [int(h) for _, h in ordered if h is not None]
    first = next((int(h) for p, h in ordered if p == "first" and h is not None), None)
    last = next((int(h) for p, h in ordered if p == "last" and h is not None), None)
    # Single-author papers carry only a "first" position; the sole author is
    # also the senior author.
    if last is None and len(authors) == 1:
        last = first
    return {"a": hs, "f": first, "l": last}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--db", type=Path, default=Path(DEFAULT_DB))
    args = parser.parse_args()

    repo_root: Path = args.repo_root
    if not args.db.exists():
        print(f"ERROR: database not found at {args.db} — is the backup drive mounted?")
        return 1

    csv_name = latest_csv_filename(repo_root)
    csv_path = repo_root / "data" / csv_name
    out_path = repo_root / "data" / "original_paper_h_index.json"
    report_path = repo_root / "scripts" / "h_index_match_report.txt"

    # ---- Collect unique original DOIs from the CSV ------------------------
    total_rows = 0
    rows_with_doi = 0
    dois: dict[str, None] = {}
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            total_rows += 1
            norm = normalize_doi_url(str(row.get("original_url") or ""))
            if norm:
                rows_with_doi += 1
                dois.setdefault(norm)
    doi_list = sorted(dois)
    print(f"{csv_name}: {total_rows} rows, {rows_with_doi} with a DOI, {len(doi_list)} unique DOIs")

    # ---- Query the SciSciNet db --------------------------------------------
    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    cur = con.cursor()
    papers: dict[str, dict] = {}
    unmatched: list[str] = []
    no_authors: list[str] = []
    started = time.monotonic()
    for i, doi in enumerate(doi_list, 1):
        rec = paper_h_indexes(cur, doi)
        if rec is None:
            unmatched.append(doi)
        elif not rec["a"]:
            no_authors.append(doi)
        else:
            papers[doi] = rec
        if i % 500 == 0 or i == len(doi_list):
            rate = i / (time.monotonic() - started)
            print(f"  {i}/{len(doi_list)} DOIs ({rate:.0f}/s, {len(papers)} matched)", flush=True)
    con.close()

    # ---- Assemble output ---------------------------------------------------
    meta = {
        "generated": date.today().isoformat(),
        "source": (
            "SciSciNet-v2 dashboard SQLite snapshot (derived from OpenAlex), "
            f"backup dated {DB_SNAPSHOT}"
        ),
        "note": (
            "Per-paper author h-indexes for original papers in the replications "
            "database. a = h-index of each author in byline order (first, "
            "middles, last; authors missing from the snapshot are dropped), "
            "f/l = first-/last-author h-index (null if unavailable; f = l for "
            "single-author papers). h-indexes are CURRENT values as of the "
            "snapshot, not values at the paper's publication date."
        ),
        "csv": csv_name,
        "dbSnapshot": DB_SNAPSHOT,
    }
    out_path.write_text(
        json.dumps({"_meta": meta, "papers": papers}, separators=(",", ":"), ensure_ascii=False)
    )
    print(f"wrote {out_path} ({len(papers)} papers, {out_path.stat().st_size / 1e6:.1f} MB)")

    # ---- Report ------------------------------------------------------------
    means = sorted(sum(p["a"]) / len(p["a"]) for p in papers.values())
    maxes = sorted(max(p["a"]) for p in papers.values())
    firsts = sorted(p["f"] for p in papers.values() if p["f"] is not None)
    lasts = sorted(p["l"] for p in papers.values() if p["l"] is not None)
    n_authors = sorted(len(p["a"]) for p in papers.values())

    def dist(name: str, vals: list) -> str:
        if not vals:
            return f"{name}: n/a"
        q = lambda k: vals[min(len(vals) - 1, int(k * len(vals)))]
        return (
            f"{name}: n={len(vals)}, min {vals[0]}, p25 {q(0.25)}, median "
            f"{statistics.median(vals)}, p75 {q(0.75)}, p90 {q(0.9)}, max {vals[-1]}"
        )

    lines = [
        "Original-paper author h-index match report",
        f"generated: {meta['generated']}   csv: {csv_name}",
        f"source: {meta['source']}",
        "",
        f"CSV rows: {total_rows}; rows with an original DOI: {rows_with_doi}",
        f"unique DOIs: {len(doi_list)}; matched with author h-index data: {len(papers)} "
        f"({100 * len(papers) / max(1, len(doi_list)):.1f}%); "
        f"unmatched: {len(unmatched)}; matched but no author records: {len(no_authors)}",
        "",
        dist("mean h-index per paper", [round(m, 1) for m in means]),
        dist("max h-index per paper", maxes),
        dist("first-author h-index", firsts),
        dist("last-author h-index", lasts),
        dist("authors with h-index per paper", n_authors),
        "",
        f"papers matched but with no author records ({len(no_authors)}):",
    ]
    lines.extend(f"  {d}" for d in no_authors)
    lines.append("")
    lines.append(f"unmatched DOIs ({len(unmatched)}):")
    lines.extend(f"  {d}" for d in unmatched)
    report_path.write_text("\n".join(lines) + "\n")
    print(f"wrote {report_path}")
    print(f"match rate: {100 * len(papers) / max(1, len(doi_list)):.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
