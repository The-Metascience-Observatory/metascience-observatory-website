#!/usr/bin/env python3
"""Build data/author_overlap.json: author overlap between each original paper
and its replication paper.

For every unique (original DOI, replication DOI) pair in the current
replications database CSV (the newest one listed in data/version_history.txt),
resolves both papers to disambiguated OpenAlex author lists and counts how
many authors the two papers share. Emits a compact JSON committed to the repo
so the website never touches the 1.5 TB database or the OpenAlex API at
runtime.

Used by app/replications-database/by-author-overlap/ to plot replication rate
against the number of authors shared between original and replication.

Matching is tiered, most reliable first:
  1. Author lists come from the local SciSciNet-v2 SQLite snapshot (OpenAlex
     author IDs), falling back to the OpenAlex API for DOIs missing from the
     snapshot, falling back to the CSV's own author-name columns when a DOI
     resolves nowhere.
  2. Two authors are "the same person" if they share an OpenAlex author ID,
     OR if their normalized names match (diacritics stripped, lowercased,
     surname + first initial). Name matches between authors whose OpenAlex
     IDs BOTH exist but differ are checked against ORCID: different ORCIDs
     veto the match, equal ORCIDs confirm it, missing ORCIDs let it stand
     (a shared name on a paper and its direct replication is strong evidence
     of identity; OpenAlex disambiguation errors are mostly splits).
Per-pair provenance (id-verified vs name-only match counts, source tier) is
stored so the page can offer a strict "ID-verified only" sensitivity toggle.

RE-RUN THIS SCRIPT whenever a new replications_database_*.csv version lands
(requires the backup drive to be mounted; --skip-db for an API-only run).
Progress is checkpointed to scripts/.author_overlap_checkpoint.jsonl, so an
interrupted run resumes where it left off; the checkpoint is deleted after a
fully successful run. Pass --fresh to ignore an existing checkpoint.

Usage:
    python3 scripts/build_author_overlap.py \
        [--repo-root /path/to/repo] [--db /path/to/journals.db] \
        [--limit N] [--fresh] [--skip-db]

Outputs:
    data/author_overlap.json                  (committed; consumed by the website)
    scripts/author_overlap_match_report.txt   (match/coverage report; committed)

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
import sqlite3
import sys
import threading
import time
import unicodedata
from datetime import date
from pathlib import Path

import requests

DEFAULT_DB = (
    "/media/dan/Seagate Portable Drive/"
    "sciscinet-dashboard_database_backup_01_29_2026/data/journals.db"
)
DB_SNAPSHOT = "2026-01-29"

OPENALEX_BASE = "https://api.openalex.org/works"
BATCH_SIZE = 50          # DOIs per resolution request (OpenAlex OR-filter limit)
TARGET_RPS = 8.0
MAX_RETRIES = 6

SRC_RANK = {"db": 0, "api": 1, "names": 2}

NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
SURNAME_PARTICLES = {
    "van", "von", "de", "del", "della", "di", "da", "dal", "le", "la", "lo",
    "ter", "ten", "der", "den", "dos", "das", "du", "el", "al", "st", "bin",
    "ibn", "abu", "van der", "van den",
}


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
    """Canonicalize a CSV URL to https://doi.org/<lowercased doi>. Identical to
    build_original_paper_citations.py (and paper_summary.doi in the SciSciNet
    db uses the same form)."""
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


def normalize_orcid(raw: str | None) -> str | None:
    """Bare 16-char ORCID (with dashes), from URL or bare form; None if empty."""
    if not raw:
        return None
    s = str(raw).strip().rstrip("/")
    if not s:
        return None
    return s.rsplit("/", 1)[-1].upper() or None


# ---------------------------------------------------------------------------
# Name normalization / matching
# ---------------------------------------------------------------------------

def strip_diacritics(s: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch)
    )


def _name_tokens(name: str) -> list[str]:
    """Lowercased, diacritic-stripped, punctuation-free tokens in
    First ... Last order; suffixes dropped; hyphens/apostrophes fused
    ("Garcia-Lopez" -> "garcialopez"). Empty list if unusable."""
    s = str(name or "").strip()
    if not s:
        return []
    # "Last, First" -> "First Last" (unless the comma introduces a suffix,
    # e.g. "Smith, Jr.")
    if "," in s:
        head, tail = s.split(",", 1)
        tail_first = re.sub(r"[^\w]", "", tail.strip().split(" ")[0]).lower()
        if tail_first and tail_first not in NAME_SUFFIXES:
            s = f"{tail.strip()} {head.strip()}"
        else:
            s = head.strip()
    s = strip_diacritics(s).lower()
    s = s.replace("-", "").replace("'", "").replace("’", "")
    s = re.sub(r"[.·]", " ", s)
    s = re.sub(r"[^a-z\s]", "", s)
    tokens = [t for t in s.split() if t and t not in NAME_SUFFIXES]
    return tokens


def name_keys(name: str) -> tuple[set[tuple[str, str]], str, str] | None:
    """(set of (surname, first_initial) key variants, full normalized name,
    first given-name token), or None for unusable names (single-token entries
    such as bare consortium names — excluded from name matching, still counted
    in byline sizes)."""
    tokens = _name_tokens(name)
    if len(tokens) < 2:
        return None
    surname = tokens[-1]
    initial = tokens[0][0]
    keys = {(surname, initial)}
    # Surname particles: "Gerard van den Berg" should also key as "denberg"
    # and "vandenberg" so it matches "G. Vandenberg" and bare "G. Berg" alike.
    fused = surname
    k = len(tokens) - 2
    while k >= 1 and tokens[k] in SURNAME_PARTICLES:
        fused = tokens[k] + fused
        keys.add((fused, initial))
        k -= 1
    # Compound surnames written with a space: "Maria Garcia Lopez" should
    # also key as "garcialopez" so it matches "María García-López" (whose
    # hyphen was fused during tokenization).
    if len(tokens) >= 3 and tokens[-2] not in SURNAME_PARTICLES:
        keys.add((tokens[-2] + surname, initial))
    return keys, " ".join(tokens), tokens[0]


class Author:
    __slots__ = ("aid", "name", "orcid", "position", "keys", "full", "given")

    def __init__(self, aid: str | None, name: str, orcid: str | None, position: str):
        self.aid = aid or None
        self.name = name
        self.orcid = normalize_orcid(orcid)
        self.position = position or ""
        nk = name_keys(name)
        self.keys, self.full, self.given = (nk if nk else (set(), None, None))


def _edit_distance_le_1(a: str, b: str) -> bool:
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) > len(b):
        a, b = b, a
    i = 0
    while i < len(a) and a[i] == b[i]:
        i += 1
    if len(a) == len(b):
        return a[i + 1 :] == b[i + 1 :] if i < len(a) else True  # one substitution
    return a[i:] == b[i + 1 :]  # one insertion


def given_names_compatible(a: Author, b: Author) -> bool:
    """False only when BOTH sides carry a full (non-initial) first given name
    and the names clearly differ — rejects John/Jane Smith and Wei/Wenjie
    Wang while still allowing initials ("J. Smith"), short forms (Dan/Daniel,
    Sam/Samuel) and single-character typos ("Leonard"/"Leonared", length >= 4)
    to match."""
    ga, gb = a.given, b.given
    if not ga or not gb or len(ga) == 1 or len(gb) == 1:
        return True
    if ga == gb or ga.startswith(gb) or gb.startswith(ga):
        return True
    return len(ga) >= 4 and len(gb) >= 4 and _edit_distance_le_1(ga, gb)


def match_names(
    orig: list[Author], rep: list[Author], skip_orig: set[int], skip_rep: set[int]
) -> list[tuple[int, int]]:
    """Greedy normalized-name matching between the two author lists, skipping
    already-ID-matched indices. Ambiguous keys (two 'smith, j' on one side)
    require full normalized-name equality. Returns (orig_idx, rep_idx) pairs."""
    by_key: dict[tuple[str, str], list[int]] = {}
    for j, a in enumerate(rep):
        if j in skip_rep:
            continue
        for k in a.keys:
            by_key.setdefault(k, []).append(j)

    matches: list[tuple[int, int]] = []
    used_rep: set[int] = set()
    for i, a in enumerate(orig):
        if i in skip_orig or not a.keys:
            continue
        candidates: list[int] = []
        for k in a.keys:
            for j in by_key.get(k, []):
                if j not in used_rep and j not in candidates and given_names_compatible(a, rep[j]):
                    candidates.append(j)
        if not candidates:
            continue
        if len(candidates) == 1:
            chosen = candidates[0]
        else:
            exact = [j for j in candidates if rep[j].full == a.full]
            if len(exact) != 1:
                continue  # genuinely ambiguous; refuse to guess
            chosen = exact[0]
        matches.append((i, chosen))
        used_rep.add(chosen)
    return matches


# ---------------------------------------------------------------------------
# OpenAlex API client (same shape as build_original_paper_citations.py)
# ---------------------------------------------------------------------------

class RateLimiter:
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


def api_authorships_to_record(doi: str, work: dict) -> dict:
    """Checkpoint record from an OpenAlex work's inline authorships."""
    authors: list[list] = []
    seen: set[str] = set()
    for ship in work.get("authorships") or []:
        author = ship.get("author") or {}
        aid = str(author.get("id") or "").rsplit("/", 1)[-1] or None
        if aid and aid in seen:
            continue
        if aid:
            seen.add(aid)
        authors.append(
            [
                aid,
                str(author.get("display_name") or ""),
                normalize_orcid(author.get("orcid")),
                str(ship.get("author_position") or ""),
            ]
        )
    return {"doi": doi, "src": "api", "a": authors}


def resolve_dois_api(client: OpenAlexClient, dois: list[str]) -> dict[str, dict]:
    """Map DOI url -> checkpoint record via batched OR-filters. DOIs containing
    filter metacharacters (| ,) are resolved one at a time."""
    resolved: dict[str, dict] = {}
    plain = [d for d in dois if "|" not in d and "," not in d]
    tricky = [d for d in dois if "|" in d or "," in d]

    batches = [plain[i : i + BATCH_SIZE] for i in range(0, len(plain), BATCH_SIZE)]
    for n, batch in enumerate(batches, 1):
        data = client.get(
            {
                "filter": "doi:" + "|".join(batch),
                "select": "doi,authorships",
                "per-page": str(BATCH_SIZE),
            }
        )
        for work in data.get("results", []):
            doi = (work.get("doi") or "").lower()
            if not doi:
                continue
            rec = api_authorships_to_record(doi, work)
            prev = resolved.get(doi)
            # On the rare duplicate-DOI work, keep the record with more authors.
            if prev is None or len(rec["a"]) > len(prev["a"]):
                resolved[doi] = rec
        if n % 10 == 0 or n == len(batches):
            print(f"  resolve batch {n}/{len(batches)} ({len(resolved)} matched)", flush=True)

    for doi in tricky:
        data = client.get({"filter": f"doi:{doi}", "select": "doi,authorships", "per-page": "1"})
        for work in data.get("results", []):
            got = (work.get("doi") or "").lower()
            if got:
                resolved[got] = api_authorships_to_record(got, work)
    return resolved


# ---------------------------------------------------------------------------
# SciSciNet SQLite stage
# ---------------------------------------------------------------------------

POS_RANK = {"first": 0, "middle": 1, "last": 2}


def db_paper_authors(cur: sqlite3.Cursor, doi: str) -> dict | None:
    """Checkpoint record for one DOI from the local db, or None if absent.
    person_summary is deliberately NOT joined here (5+ extra seeks per paper
    on a slow drive); ORCIDs are fetched on demand in the overlap stage for
    the few name-match candidates that need the tie-break."""
    row = cur.execute(
        "SELECT paperid FROM paper_summary WHERE doi = ? LIMIT 1", (doi,)
    ).fetchone()
    if row is None:
        return None
    rows = cur.execute(
        """
        SELECT authorid, display_name, author_position
        FROM paper_authors
        WHERE paperid = ?
        """,
        (row[0],),
    ).fetchall()
    # paper_authors duplicates rows per affiliation; dedupe on authorid.
    seen: set[str] = set()
    deduped: list[tuple] = []
    for aid, name, pos in rows:
        key = aid or f"__name:{name}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append((aid, name, pos))
    ordered = sorted(deduped, key=lambda a: POS_RANK.get(a[2] or "", 1))
    return {
        "doi": doi,
        "src": "db",
        "a": [[aid or None, str(name or ""), None, str(pos or "")] for aid, name, pos in ordered],
    }


def db_orcids(cur: sqlite3.Cursor, authorids: list[str]) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for aid in authorids:
        row = cur.execute(
            "SELECT orcid FROM person_summary WHERE authorid = ? LIMIT 1", (aid,)
        ).fetchone()
        out[aid] = normalize_orcid(row[0]) if row else None
    return out


# ---------------------------------------------------------------------------
# Overlap computation
# ---------------------------------------------------------------------------

def authors_from_record(rec: dict) -> list[Author]:
    return [Author(aid, name, orcid, pos) for aid, name, orcid, pos in rec.get("a", [])]


def csv_names_to_authors(names_str: str) -> list[Author]:
    parts = [p.strip() for p in str(names_str or "").split(";") if p.strip()]
    authors = []
    for i, p in enumerate(parts):
        pos = "first" if i == 0 else ("last" if i == len(parts) - 1 else "middle")
        authors.append(Author(None, p, None, pos))
    return authors


def compute_overlap(
    orig: list[Author],
    rep: list[Author],
    orcid_lookup,
) -> dict:
    """Overlap record for one pair. orcid_lookup(list[authorid]) -> {aid: orcid}
    backfills ORCIDs for db-sourced authors involved in name-match tie-breaks."""
    # --- ID matches ---
    rep_by_id = {a.aid: j for j, a in enumerate(rep) if a.aid}
    id_matched: list[tuple[int, int]] = []
    for i, a in enumerate(orig):
        if a.aid and a.aid in rep_by_id:
            id_matched.append((i, rep_by_id[a.aid]))
    skip_orig = {i for i, _ in id_matched}
    skip_rep = {j for _, j in id_matched}

    # --- Name matches among the rest ---
    candidates = match_names(orig, rep, skip_orig, skip_rep)

    # ORCID tie-break: only relevant when both sides carry (differing) author
    # IDs — same-ID pairs were already caught above. Backfill missing ORCIDs
    # from person_summary for authors that have an ID but no ORCID yet.
    need_orcid = []
    for i, j in candidates:
        if orig[i].aid and rep[j].aid:
            if orig[i].orcid is None:
                need_orcid.append(orig[i].aid)
            if rep[j].orcid is None:
                need_orcid.append(rep[j].aid)
    fetched = orcid_lookup(sorted(set(need_orcid))) if need_orcid else {}

    name_matched: list[tuple[int, int]] = []
    orcid_vetoed = 0
    for i, j in candidates:
        o_orcid = orig[i].orcid or fetched.get(orig[i].aid or "")
        r_orcid = rep[j].orcid or fetched.get(rep[j].aid or "")
        if o_orcid and r_orcid and o_orcid != r_orcid:
            orcid_vetoed += 1
            continue
        name_matched.append((i, j))

    matched_orig = skip_orig | {i for i, _ in name_matched}
    first_idx = next((i for i, a in enumerate(orig) if a.position == "first"), 0 if orig else None)
    last_idx = next((i for i, a in enumerate(orig) if a.position == "last"), None)
    if last_idx is None and len(orig) == 1:
        last_idx = first_idx

    def fl_flags(matched: set[int]) -> tuple[int, int]:
        f = 1 if first_idx is not None and first_idx in matched else 0
        l = 1 if last_idx is not None and last_idx in matched else 0
        return f, l

    f, l = fl_flags(matched_orig)
    fs, ls = fl_flags(skip_orig)  # strict: ID-verified matches only
    return {
        "o": len(matched_orig),
        "no": len(orig),
        "nr": len(rep),
        "f": f,
        "l": l,
        "fs": fs,
        "ls": ls,
        "im": len(id_matched),
        "nm": len(name_matched),
        "_vetoed": orcid_vetoed,
        "_name_pairs": [(orig[i].name, rep[j].name) for i, j in name_matched],
    }


# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--db", type=Path, default=Path(DEFAULT_DB))
    parser.add_argument("--limit", type=int, default=0, help="process only the first N unique DOIs (smoke test)")
    parser.add_argument("--fresh", action="store_true", help="ignore any existing checkpoint")
    parser.add_argument("--skip-db", action="store_true", help="API-only run (backup drive not mounted)")
    args = parser.parse_args()

    repo_root: Path = args.repo_root
    use_db = not args.skip_db
    if use_db and not args.db.exists():
        print(f"ERROR: database not found at {args.db} — is the backup drive mounted?")
        print("       (pass --skip-db for an API-only run)")
        return 1
    if args.skip_db:
        print("WARNING: --skip-db: resolving every DOI via the OpenAlex API only.")

    csv_name = latest_csv_filename(repo_root)
    csv_path = repo_root / "data" / csv_name
    out_path = repo_root / "data" / "author_overlap.json"
    report_path = repo_root / "scripts" / "author_overlap_match_report.txt"
    checkpoint_path = repo_root / "scripts" / ".author_overlap_checkpoint.jsonl"

    env = load_env(repo_root)
    api_key = env.get("OPENALEXAPIKEY")
    mailto = env.get("CONTACT_EMAIL")
    if not api_key and not mailto:
        print("WARNING: no OPENALEXAPIKEY or CONTACT_EMAIL found; using anonymous pool (slow).")

    # ---- Stage 0: collect DOIs and pairs from the CSV ----------------------
    total_rows = 0
    rows_missing_orig = 0
    rows_missing_rep = 0
    rows_with_both = 0
    dois: dict[str, None] = {}
    pairs: dict[tuple[str, str], None] = {}
    csv_names: dict[str, str] = {}
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            total_rows += 1
            orig = normalize_doi_url(str(row.get("original_url") or ""))
            rep = normalize_doi_url(str(row.get("replication_url") or ""))
            if orig is None:
                rows_missing_orig += 1
            if rep is None:
                rows_missing_rep += 1
            if orig:
                dois.setdefault(orig)
                names = str(row.get("original_authors") or "").strip()
                if names and orig not in csv_names:
                    csv_names[orig] = names
            if rep:
                dois.setdefault(rep)
                names = str(row.get("replication_authors") or "").strip()
                if names and rep not in csv_names:
                    csv_names[rep] = names
            if orig and rep:
                rows_with_both += 1
                pairs.setdefault((orig, rep))
    doi_list = sorted(dois)
    if args.limit:
        doi_list = doi_list[: args.limit]
        attempted = set(doi_list)
        pairs = {p: None for p in pairs if p[0] in attempted and p[1] in attempted}
        print(f"--limit {args.limit}: {len(doi_list)} DOIs, {len(pairs)} pairs retained")
    print(
        f"{csv_name}: {total_rows} rows, {rows_with_both} with both DOIs, "
        f"{len(doi_list)} unique DOIs, {len(pairs)} unique (orig, rep) pairs"
    )

    # ---- Checkpoint (resume support) ----------------------------------------
    done: dict[str, dict] = {}
    if checkpoint_path.exists() and not args.fresh:
        for line in checkpoint_path.read_text().splitlines():
            if line.strip():
                rec = json.loads(line)
                done[rec["doi"]] = rec
        print(f"resuming: {len(done)} DOIs already in checkpoint")

    checkpoint_file = checkpoint_path.open("a", encoding="utf-8")

    def checkpoint(rec: dict) -> None:
        checkpoint_file.write(json.dumps(rec, separators=(",", ":"), ensure_ascii=False) + "\n")
        checkpoint_file.flush()

    # ---- Stage 1: local SciSciNet lookups -----------------------------------
    con = cur = None
    if use_db:
        con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
        cur = con.cursor()
        todo = [d for d in doi_list if d not in done]
        print(f"stage 1: looking up {len(todo)} DOIs in the SciSciNet db")
        started = time.monotonic()
        for i, doi in enumerate(todo, 1):
            rec = db_paper_authors(cur, doi)
            if rec is not None and rec["a"]:
                checkpoint(rec)
                done[doi] = rec
            if i % 500 == 0 or i == len(todo):
                rate = i / (time.monotonic() - started)
                print(f"  {i}/{len(todo)} DOIs ({rate:.1f}/s, {len(done)} resolved)", flush=True)

    # ---- Stage 2: OpenAlex API fallback --------------------------------------
    client = OpenAlexClient(api_key, mailto, TARGET_RPS)
    todo_api = [d for d in doi_list if d not in done]
    if todo_api:
        print(f"stage 2: resolving {len(todo_api)} DOIs via the OpenAlex API")
        resolved = resolve_dois_api(client, todo_api)
        for doi in todo_api:
            rec = resolved.get(doi)
            if rec is not None and rec["a"]:
                checkpoint(rec)
                done[doi] = rec
            else:
                rec = {"doi": doi, "src": "none"}
                checkpoint(rec)
                done[doi] = rec
    checkpoint_file.close()

    # ---- Stage 3: per-pair overlap -------------------------------------------
    orcid_cache: dict[str, str | None] = {}

    def orcid_lookup(authorids: list[str]) -> dict[str, str | None]:
        missing = [a for a in authorids if a not in orcid_cache]
        if missing and cur is not None:
            orcid_cache.update(db_orcids(cur, missing))
        for a in missing:
            orcid_cache.setdefault(a, None)
        return {a: orcid_cache[a] for a in authorids}

    out_pairs: dict[str, dict] = {}
    unresolved_pairs: list[tuple[str, str]] = []
    same_doi_pairs: list[str] = []
    name_match_log: list[str] = []
    total_vetoed = 0
    src_count = {"db": 0, "api": 0, "none": 0}
    for rec in done.values():
        src_count[rec["src"]] = src_count.get(rec["src"], 0) + 1
    side_tier_counts: dict[str, int] = {}

    for orig_doi, rep_doi in pairs:
        sides = []
        for doi in (orig_doi, rep_doi):
            rec = done.get(doi)
            if rec is not None and rec.get("src") != "none" and rec.get("a"):
                sides.append((authors_from_record(rec), SRC_RANK[rec["src"]]))
            elif doi in csv_names:
                sides.append((csv_names_to_authors(csv_names[doi]), SRC_RANK["names"]))
            else:
                sides.append((None, None))
        (orig_authors, orig_tier), (rep_authors, rep_tier) = sides
        if not orig_authors or not rep_authors:
            unresolved_pairs.append((orig_doi, rep_doi))
            continue
        if orig_doi == rep_doi:
            same_doi_pairs.append(orig_doi)

        result = compute_overlap(orig_authors, rep_authors, orcid_lookup)
        total_vetoed += result.pop("_vetoed")
        name_pairs = result.pop("_name_pairs")
        if name_pairs:
            name_match_log.append(
                f"  {orig_doi} | {rep_doi}\n"
                + "\n".join(f"    {a}  <->  {b}" for a, b in name_pairs)
            )
        tier = max(orig_tier, rep_tier)
        result["t"] = tier
        side_tier_counts[f"tier{tier}"] = side_tier_counts.get(f"tier{tier}", 0) + 1
        out_pairs[f"{orig_doi}|{rep_doi}"] = result

    if con is not None:
        con.close()

    # ---- Assemble output ------------------------------------------------------
    meta = {
        "generated": date.today().isoformat(),
        "source": (
            "SciSciNet-v2 dashboard SQLite snapshot (derived from OpenAlex, "
            f"backup dated {DB_SNAPSHOT}) + OpenAlex API fallback + CSV author-name matching"
        ),
        "note": (
            "Author overlap between each original paper and its replication. "
            "Keys are '<original doi url>|<replication doi url>'. o = shared "
            "authors (counted on the original's byline), no/nr = original/"
            "replication byline sizes, f/l = original's first/last author is "
            "among the shared (l = f for single-author originals), im/nm = "
            "shared authors verified by OpenAlex author ID vs matched by "
            "normalized name only (o = im + nm), t = source tier (0 = both "
            "papers in the local snapshot or OpenAlex, 1 = API fallback "
            "involved, 2 = CSV name-column fallback involved)."
        ),
        "csv": csv_name,
        "dbSnapshot": DB_SNAPSHOT,
    }
    out_path.write_text(
        json.dumps({"_meta": meta, "pairs": out_pairs}, separators=(",", ":"), ensure_ascii=False)
    )
    print(f"wrote {out_path} ({len(out_pairs)} pairs, {out_path.stat().st_size / 1e6:.1f} MB)")

    # ---- Report -----------------------------------------------------------------
    overlaps = [p["o"] for p in out_pairs.values()]
    dist = {k: 0 for k in ("0", "1", "2", "3+")}
    for o in overlaps:
        dist["3+" if o >= 3 else str(o)] += 1
    with_overlap = sum(1 for o in overlaps if o > 0)
    fl = sum(1 for p in out_pairs.values() if p["f"] or p["l"])
    nm_pairs = sum(1 for p in out_pairs.values() if p["nm"] > 0)

    lines = [
        "Author-overlap match report",
        f"generated: {meta['generated']}   csv: {csv_name}",
        f"source: {meta['source']}",
        "",
        f"CSV rows: {total_rows}; rows missing original DOI: {rows_missing_orig}; "
        f"missing replication DOI: {rows_missing_rep}; with both: {rows_with_both}",
        f"unique DOIs attempted: {len(doi_list)}; resolved via db: {src_count.get('db', 0)}, "
        f"via API: {src_count.get('api', 0)}, unresolved: {src_count.get('none', 0)}",
        f"unique (orig, rep) pairs: {len(pairs)}; with overlap data: {len(out_pairs)}; "
        f"unresolved (no author info on one side): {len(unresolved_pairs)}",
        f"pair tiers: {json.dumps(side_tier_counts)}",
        "",
        f"overlap distribution: {json.dumps(dist)} "
        f"({100 * with_overlap / max(1, len(out_pairs)):.1f}% of pairs share >= 1 author)",
        f"pairs where original's first/last author is on the replication: {fl} "
        f"({100 * fl / max(1, len(out_pairs)):.1f}%)",
        f"pairs relying on name-only matches (nm > 0): {nm_pairs}; "
        f"name matches vetoed by conflicting ORCIDs: {total_vetoed}",
        f"pairs where original DOI == replication DOI (self-pair, suspect data): {len(same_doi_pairs)}",
    ]
    lines.extend(f"  {d}" for d in same_doi_pairs)
    lines.append("")
    lines.append(f"name-only matches for spot-checking ({len(name_match_log)} pairs):")
    lines.extend(name_match_log)
    lines.append("")
    lines.append(f"unresolved pairs ({len(unresolved_pairs)}):")
    lines.extend(f"  {o} | {r}" for o, r in unresolved_pairs)
    report_path.write_text("\n".join(lines) + "\n")
    print(f"wrote {report_path}")
    print(
        f"pair coverage: {100 * len(out_pairs) / max(1, len(pairs)):.1f}%; "
        f"{100 * with_overlap / max(1, len(out_pairs)):.1f}% of pairs share an author"
    )

    if not args.limit:
        checkpoint_path.unlink(missing_ok=True)
    else:
        print("(--limit run: checkpoint kept for the full run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
