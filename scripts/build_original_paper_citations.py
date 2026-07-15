#!/usr/bin/env python3
"""Build data/original_paper_citations.json from the OpenAlex API.

For every unique original-paper DOI in the current replications database CSV
(the newest one listed in data/version_history.txt), fetches the paper's total
citation count and its per-year citation trajectory (citations received in
each calendar year) from OpenAlex, and emits a compact JSON committed to the
repo so the website never calls OpenAlex at runtime.

Used by app/replications-database/by-citation-count/ to reproduce Fig. 1 of
Yang, Youyou & Uzzi (PNAS 2020, doi:10.1073/pnas.1909046117): mean citations
per year for originals that passed vs. failed replication.

RE-RUN THIS SCRIPT whenever a new replications_database_*.csv version lands.
Progress is checkpointed to scripts/.citation_checkpoint.jsonl, so an
interrupted run resumes where it left off; the checkpoint is deleted after a
fully successful run. Pass --fresh to ignore an existing checkpoint.

Usage:
    python3 scripts/build_original_paper_citations.py \
        [--repo-root /path/to/repo] [--fresh] [--max-workers 8]

Outputs:
    data/original_paper_citations.json    (committed; consumed by the website)
    scripts/citation_match_report.txt     (match/coverage report; committed)

API credentials are read from .env.local (OPENALEXAPIKEY, CONTACT_EMAIL) or
the environment. Without a key the script still works via the polite pool,
just slower.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

import requests

OPENALEX_BASE = "https://api.openalex.org/works"
BATCH_SIZE = 50          # DOIs per resolution request (OpenAlex OR-filter limit)
TARGET_RPS = 8.0         # polite request rate across all workers
MAX_RETRIES = 6
# Citations from the current (incomplete) calendar year are excluded from the
# per-year trajectory so the last data point is a full year.
LAST_COMPLETE_YEAR = date.today().year - 1


def latest_csv_filename(repo_root: Path) -> str:
    lines = (repo_root / "data" / "version_history.txt").read_text().strip().split("\n")
    lines = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    return lines[-1].split("#")[0].strip()


def load_env(repo_root: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    env_path = repo_root / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    for key in ("OPENALEXAPIKEY", "CONTACT_EMAIL"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    return env


def normalize_doi_url(raw: str) -> str | None:
    """Canonicalize a CSV original_url to OpenAlex's DOI form:
    https://doi.org/<lowercased doi>. Returns None for non-DOI URLs."""
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


class RateLimiter:
    """Simple cross-thread limiter: at most TARGET_RPS requests per second."""

    def __init__(self, rps: float):
        self.interval = 1.0 / rps
        self.lock = threading.Lock()
        self.next_time = time.monotonic()

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            if self.next_time <= now:
                self.next_time = now + self.interval
                return
            delay = self.next_time - now
            self.next_time += self.interval
        time.sleep(delay)


class OpenAlexClient:
    def __init__(self, api_key: str | None, mailto: str | None, rps: float):
        self.session = requests.Session()
        self.params: dict[str, str] = {}
        if api_key:
            self.params["api_key"] = api_key
        if mailto:
            self.params["mailto"] = mailto
        self.limiter = RateLimiter(rps)

    def get(self, params: dict[str, str]) -> dict:
        merged = {**self.params, **params}
        for attempt in range(MAX_RETRIES):
            self.limiter.wait()
            try:
                resp = self.session.get(OPENALEX_BASE, params=merged, timeout=60)
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code in (429, 500, 502, 503, 504):
                    time.sleep(min(2 ** attempt, 30))
                    continue
                resp.raise_for_status()
            except requests.RequestException:
                if attempt == MAX_RETRIES - 1:
                    raise
                time.sleep(min(2 ** attempt, 30))
        raise RuntimeError(f"OpenAlex request failed after {MAX_RETRIES} retries: {params}")


def resolve_dois(client: OpenAlexClient, dois: list[str]) -> dict[str, dict]:
    """Map DOI url -> {id, publication_year, cited_by_count} via batched OR-filters.
    DOIs containing filter metacharacters (| ,) are resolved one at a time."""
    resolved: dict[str, dict] = {}
    plain = [d for d in dois if "|" not in d and "," not in d]
    tricky = [d for d in dois if d not in plain]

    batches = [plain[i : i + BATCH_SIZE] for i in range(0, len(plain), BATCH_SIZE)]
    for n, batch in enumerate(batches, 1):
        data = client.get(
            {
                "filter": "doi:" + "|".join(batch),
                "select": "id,doi,publication_year,cited_by_count",
                "per-page": str(BATCH_SIZE),
            }
        )
        for work in data.get("results", []):
            doi = (work.get("doi") or "").lower()
            if not doi:
                continue
            prev = resolved.get(doi)
            # On the rare duplicate-DOI work, keep the better-cited record.
            if prev is None or (work.get("cited_by_count") or 0) > (prev.get("cited_by_count") or 0):
                resolved[doi] = work
        if n % 10 == 0 or n == len(batches):
            print(f"  resolve batch {n}/{len(batches)} ({len(resolved)} matched)", flush=True)

    for doi in tricky:
        data = client.get(
            {"filter": f"doi:{doi}", "select": "id,doi,publication_year,cited_by_count", "per-page": "1"}
        )
        for work in data.get("results", []):
            resolved[(work.get("doi") or "").lower()] = work
    return resolved


def fetch_trajectory(client: OpenAlexClient, work_id: str) -> dict[int, int]:
    """Citations received per citing-publication-year, via group_by."""
    data = client.get(
        {"filter": f"cites:{work_id}", "group_by": "publication_year", "per-page": "200"}
    )
    counts: dict[int, int] = {}
    for group in data.get("group_by", []):
        try:
            year = int(group["key"])
        except (KeyError, TypeError, ValueError):
            continue
        counts[year] = counts.get(year, 0) + int(group.get("count") or 0)
    return counts


def build_by_array(pub_year: int, counts: dict[int, int]) -> list[int]:
    """counts keyed by calendar year -> offsets from pub_year through
    LAST_COMPLETE_YEAR. Citing years before publication (OpenAlex metadata
    noise, preprints) are clamped into t=0."""
    length = LAST_COMPLETE_YEAR - pub_year + 1
    if length <= 0:
        return []
    by = [0] * length
    for year, count in counts.items():
        if year > LAST_COMPLETE_YEAR:
            continue
        t = max(0, year - pub_year)
        if t < length:
            by[t] += count
    return by


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--fresh", action="store_true", help="ignore any existing checkpoint")
    parser.add_argument("--max-workers", type=int, default=8)
    args = parser.parse_args()

    repo_root: Path = args.repo_root
    csv_name = latest_csv_filename(repo_root)
    csv_path = repo_root / "data" / csv_name
    out_path = repo_root / "data" / "original_paper_citations.json"
    report_path = repo_root / "scripts" / "citation_match_report.txt"
    checkpoint_path = repo_root / "scripts" / ".citation_checkpoint.jsonl"

    env = load_env(repo_root)
    api_key = env.get("OPENALEXAPIKEY")
    mailto = env.get("CONTACT_EMAIL")
    if not api_key and not mailto:
        print("WARNING: no OPENALEXAPIKEY or CONTACT_EMAIL found; using anonymous pool (slow).")

    # ---- Collect unique original DOIs from the CSV ------------------------
    doi_by_raw: dict[str, str] = {}
    total_rows = 0
    rows_with_doi = 0
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            total_rows += 1
            norm = normalize_doi_url(str(row.get("original_url") or ""))
            if norm:
                rows_with_doi += 1
                doi_by_raw.setdefault(norm, norm)
    dois = sorted(doi_by_raw)
    print(f"{csv_name}: {total_rows} rows, {rows_with_doi} with a DOI, {len(dois)} unique DOIs")

    # ---- Checkpoint (resume support) --------------------------------------
    done: dict[str, dict] = {}
    if checkpoint_path.exists() and not args.fresh:
        for line in checkpoint_path.read_text().splitlines():
            if line.strip():
                rec = json.loads(line)
                done[rec["doi"]] = rec
        print(f"resuming: {len(done)} DOIs already in checkpoint")

    client = OpenAlexClient(api_key, mailto, TARGET_RPS)
    checkpoint_lock = threading.Lock()
    checkpoint_file = checkpoint_path.open("a", encoding="utf-8")

    def checkpoint(rec: dict) -> None:
        with checkpoint_lock:
            checkpoint_file.write(json.dumps(rec, separators=(",", ":")) + "\n")
            checkpoint_file.flush()

    # ---- Stage 1: resolve DOIs -> OpenAlex work stubs ----------------------
    todo_resolve = [d for d in dois if d not in done]
    print(f"stage 1: resolving {len(todo_resolve)} DOIs (batched)")
    resolved = resolve_dois(client, todo_resolve) if todo_resolve else {}
    for doi in todo_resolve:
        if doi not in resolved:
            checkpoint({"doi": doi, "unmatched": True})
            done[doi] = {"doi": doi, "unmatched": True}

    # ---- Stage 2: per-paper citation trajectories --------------------------
    todo_fetch = [(doi, resolved[doi]) for doi in todo_resolve if doi in resolved]
    print(f"stage 2: fetching trajectories for {len(todo_fetch)} papers")
    started = time.monotonic()
    completed = 0

    def fetch_one(doi: str, work: dict) -> dict:
        work_id = str(work.get("id") or "").rsplit("/", 1)[-1]
        counts = fetch_trajectory(client, work_id)
        return {
            "doi": doi,
            "id": work_id,
            "y": work.get("publication_year"),
            "n": work.get("cited_by_count") or 0,
            "counts": {str(k): v for k, v in sorted(counts.items())},
        }

    with ThreadPoolExecutor(max_workers=args.max_workers) as pool:
        futures = {pool.submit(fetch_one, doi, work): doi for doi, work in todo_fetch}
        for future in as_completed(futures):
            doi = futures[future]
            try:
                rec = future.result()
            except Exception as exc:  # keep going; unfetched papers stay resumable
                print(f"  ERROR {doi}: {exc}", flush=True)
                continue
            checkpoint(rec)
            done[doi] = rec
            completed += 1
            if completed % 200 == 0:
                rate = completed / (time.monotonic() - started)
                eta = (len(todo_fetch) - completed) / rate / 60 if rate else 0
                print(f"  {completed}/{len(todo_fetch)} trajectories ({rate:.1f}/s, ~{eta:.0f} min left)", flush=True)
    checkpoint_file.close()

    failures = [d for d, _ in todo_fetch if d not in done]
    if failures:
        print(f"{len(failures)} papers failed to fetch; re-run to resume from checkpoint.")
        return 1

    # ---- Assemble output ---------------------------------------------------
    papers: dict[str, dict] = {}
    unmatched: list[str] = []
    sum_mismatches: list[tuple[str, int, int]] = []
    for doi in dois:
        rec = done[doi]
        if rec.get("unmatched"):
            unmatched.append(doi)
            continue
        counts = {int(k): v for k, v in rec["counts"].items()}
        pub_year = rec.get("y")
        n = int(rec.get("n") or 0)
        entry: dict = {"y": pub_year, "n": n}
        if isinstance(pub_year, int):
            entry["by"] = build_by_array(pub_year, counts)
        else:
            entry["by"] = None  # no publication year: totals-only paper
        papers[doi] = entry
        # group_by sums (all years, incl. the partial current year) should be
        # close to cited_by_count; large gaps indicate an OpenAlex data issue.
        group_total = sum(counts.values())
        if n > 0 and abs(group_total - n) > max(10, 0.1 * n):
            sum_mismatches.append((doi, n, group_total))

    meta = {
        "generated": date.today().isoformat(),
        "source": "OpenAlex API (api.openalex.org)",
        "note": (
            "Per-year direct-citation trajectories of original papers in the "
            "replications database. by[t] = citations received t calendar years "
            f"after publication, through {LAST_COMPLETE_YEAR} (current partial "
            "year excluded); citing years before publication are clamped into "
            "t=0. n = OpenAlex cited_by_count at generation time."
        ),
        "csv": csv_name,
        "lastCompleteYear": LAST_COMPLETE_YEAR,
    }
    out_path.write_text(
        json.dumps({"_meta": meta, "papers": papers}, separators=(",", ":"), ensure_ascii=False)
    )
    print(f"wrote {out_path} ({len(papers)} papers, {out_path.stat().st_size / 1e6:.1f} MB)")

    # ---- Report ------------------------------------------------------------
    totals = sorted(p["n"] for p in papers.values())
    years = sorted(p["y"] for p in papers.values() if isinstance(p["y"], int))

    def pct(k: float) -> int:
        return totals[min(len(totals) - 1, int(k * len(totals)))]

    lines = [
        "Original-paper citation match report",
        f"generated: {meta['generated']}   csv: {csv_name}   source: OpenAlex API",
        "",
        f"CSV rows: {total_rows}; rows with an original DOI: {rows_with_doi}",
        f"unique DOIs: {len(dois)}; matched in OpenAlex: {len(papers)} "
        f"({100 * len(papers) / max(1, len(dois)):.1f}%); unmatched: {len(unmatched)}",
        f"papers with a publication year (trajectory available): {len(years)}",
        "",
        f"cited_by_count distribution: min {totals[0]}, median {statistics.median(totals)}, "
        f"p90 {pct(0.9)}, max {totals[-1]}",
        f"publication years: {years[0]}-{years[-1]}" if years else "publication years: n/a",
        "",
        f"papers where |sum(group_by) - cited_by_count| > max(10, 10%): {len(sum_mismatches)}",
    ]
    for doi, n, group_total in sum_mismatches[:20]:
        lines.append(f"  {doi}  cited_by_count={n}  group_by_sum={group_total}")
    lines.append("")
    lines.append(f"unmatched DOIs ({len(unmatched)}):")
    lines.extend(f"  {d}" for d in unmatched)
    report_path.write_text("\n".join(lines) + "\n")
    print(f"wrote {report_path}")
    print(f"match rate: {100 * len(papers) / max(1, len(dois)):.1f}%")

    checkpoint_path.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
