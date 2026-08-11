#!/usr/bin/env python3
"""Backfill DOIs for master-CSV rows whose original_url is not a doi.org link.

Dry-run by default: writes a report and never touches the master CSV. Applying
the accepted rows is a separate, deliberate step (--apply).

Four tiers, in decreasing order of trust:

  A  DOI already present in the URL (or derivable, e.g. arXiv -> 10.48550/arXiv.N)
  B  PMID -> DOI via NCBI esummary + the PMC ID Converter
  C  Semantic Scholar paper hash -> externalIds.DOI
  D  title -> DOI via fetch_metadata_from_title()

Tiers A-C are exact identifier lookups and carry no matching risk. Tier D is the
only fuzzy one; it delegates to fetch_metadata_from_title(), which gates on title
similarity >= 0.9 AND hard-fails on a year or journal mismatch. That gate is what
keeps near-miss matches out -- e.g. the 1995 juvenile-myoclonic-epilepsy row,
whose top Crossref hit is a *different* paper (chromosome 6p12-p11 in Am J Med
Genet, not 6p21.2-p11 in AJHG) at 0.64 title / 0.89 journal similarity. Do not
loosen the threshold or add a "best effort" fallback: a wrong DOI silently
misattributes a study and is far worse than a missing one.

Most of these rows have no DOI to find -- they are pre-1996 or grey-literature
items (books, dissertations, agency reports) that were never assigned one. A low
fill rate is the expected, correct outcome.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_metadata_from_title import fetch_metadata_from_title  # noqa: E402
from validation_rules import _norm_doi  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
VERSION_HISTORY = os.path.join(DATA_DIR, "version_history.txt")
REPORT_PATH = os.path.join(DATA_DIR, "doi_backfill_report.csv")

CONTACT = os.environ.get("CONTACT_EMAIL", "delton17@gmail.com")
UA = {"User-Agent": f"MetascienceObservatory/1.0 (mailto:{CONTACT})"}

DOI_IN_URL = re.compile(r"(10\.\d{4,9}/[^\s?&#]+)")
ARXIV_ID = re.compile(r"arxiv\.org/abs/([0-9]{4}\.[0-9]{4,5}|[a-z\-]+/[0-9]{7})", re.I)
PMID_URL = re.compile(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)")
S2_HASH = re.compile(r"semanticscholar\.org/paper/(?:[^/]*/)?([0-9a-f]{40})", re.I)

# Crossref happily returns post-publication commentary stubs that mirror the
# original title. They are never the paper we want.
JUNK_TITLE = re.compile(
    r"faculty opinions|f1000|erratum|correction to|corrigendum|retraction of|withdrawn", re.I
)


def master_csv_path():
    """Resolve the master CSV from the last non-comment line of version_history.txt."""
    with open(VERSION_HISTORY, encoding="utf-8") as fh:
        lines = [ln.strip() for ln in fh if ln.strip() and not ln.lstrip().startswith("#")]
    if not lines:
        raise SystemExit("version_history.txt has no usable entry")
    fname = lines[-1].split("#", 1)[0].strip()
    path = os.path.join(DATA_DIR, fname)
    if not os.path.exists(path):
        raise SystemExit(f"master CSV named by version_history.txt is missing: {fname}")
    return path


def url_host(url):
    url = (url or "").strip()
    if not url:
        return None
    try:
        return urllib.parse.urlparse(url).netloc.lower().replace("www.", "")
    except ValueError:
        return "PARSE_ERROR"


def needs_backfill(row):
    return url_host(row.get("original_url")) not in (None, "doi.org")


def _get_json(url, timeout=45, data=None, headers=None):
    hdrs = dict(UA)
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except Exception as exc:  # noqa: BLE001 - any failure just means "no answer"
        print(f"    ! {type(exc).__name__}: {str(exc)[:90]}", file=sys.stderr)
        return None


# --------------------------------------------------------------------------
# Tier A - identifier already in the URL
# --------------------------------------------------------------------------

def tier_a(url):
    m = ARXIV_ID.search(url)
    if m:
        return f"10.48550/arXiv.{m.group(1)}", "arxiv id in url"
    # Skip the DOI-ish suffix of a semanticscholar/pdf path; those are hashes.
    if "semanticscholar.org" not in url:
        m = DOI_IN_URL.search(url)
        if m:
            return m.group(1).rstrip("."), "doi embedded in url"
    return None, None


# --------------------------------------------------------------------------
# Tier B - PMID -> DOI
# --------------------------------------------------------------------------

def pmid_to_doi_batch(pmids):
    """Return {pmid: doi} using esummary, then the ID Converter for the rest."""
    out = {}
    if not pmids:
        return out
    key = os.environ.get("ENTREZ_EUTILS_API_KEY") or os.environ.get("NCBI_API_KEY")
    for chunk_start in range(0, len(pmids), 100):
        chunk = pmids[chunk_start:chunk_start + 100]
        url = ("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
               f"?db=pubmed&retmode=json&id={','.join(chunk)}")
        if key:
            url += f"&api_key={key}"
        data = _get_json(url)
        result = (data or {}).get("result", {})
        for pmid in result.get("uids", []):
            for ident in result[pmid].get("articleids", []):
                if ident.get("idtype") == "doi" and ident.get("value"):
                    out[pmid] = ident["value"]
                    break
        time.sleep(0.4)

    missing = [p for p in pmids if p not in out]
    if missing:
        url = ("https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/"
               f"?tool=metascience-observatory&email={CONTACT}&format=json&ids={','.join(missing)}")
        data = _get_json(url)
        for rec in (data or {}).get("records", []):
            if rec.get("doi") and rec.get("pmid"):
                out[rec["pmid"]] = rec["doi"]
        time.sleep(0.4)
    return out


# --------------------------------------------------------------------------
# Tier C - Semantic Scholar hash -> DOI
# --------------------------------------------------------------------------

def s2_to_doi_batch(hashes):
    out = {}
    if not hashes:
        return out
    base = {"Content-Type": "application/json"}
    api_key = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")
    # The stored key currently 403s while the public pool answers fine. Never let a
    # rejected key look like "this paper has no DOI" -- fall back to keyless.
    headers = dict(base, **{"x-api-key": api_key}) if api_key else base
    url = ("https://api.semanticscholar.org/graph/v1/paper/batch"
           "?fields=title,year,venue,externalIds")
    for start in range(0, len(hashes), 100):
        chunk = hashes[start:start + 100]
        payload = json.dumps({"ids": chunk}).encode()
        data = _get_json(url, data=payload, headers=headers)
        if data is None and headers is not base:
            print("    (semantic scholar key rejected; retrying without it)", file=sys.stderr)
            headers = base
            time.sleep(2.0)
            data = _get_json(url, data=payload, headers=headers)
        if isinstance(data, list):
            for h, rec in zip(chunk, data):
                doi = ((rec or {}).get("externalIds") or {}).get("DOI")
                if doi:
                    out[h] = doi
        time.sleep(1.0)
    return out


# --------------------------------------------------------------------------
# Tier D - title -> DOI (the only fuzzy tier; gated inside the resolver)
# --------------------------------------------------------------------------

def tier_d(row):
    title = (row.get("original_title") or "").strip()
    if not title:
        return None, "no title to search on"
    year = (row.get("original_year") or "").strip().replace(".0", "")
    try:
        year_i = int(float(year)) if year else None
    except ValueError:
        year_i = None
    meta = fetch_metadata_from_title(
        title,
        authors=(row.get("original_authors") or "").strip() or None,
        journal=(row.get("original_journal") or "").strip() or None,
        year=year_i,
        delay=0.3,
    )
    if not meta:
        return None, "resolver refused (no confident match)"
    doi = meta.get("doi")
    if not doi:
        pmid = meta.get("pmid")
        return None, f"matched paper but it has no DOI{f' (pmid {pmid})' if pmid else ''}"
    if JUNK_TITLE.search(meta.get("title") or ""):
        return None, f"rejected junk match: {(meta.get('title') or '')[:60]}"
    return doi, meta


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="write a new master CSV (default is dry-run/report only)")
    ap.add_argument("--accept", metavar="FILE",
                    help="with --apply: only apply DOIs for the CSV line numbers listed "
                         "in this file (one per line). Required for tier D rows.")
    ap.add_argument("--skip-tier-d", action="store_true",
                    help="skip the title-matching tier (identifier lookups only)")
    args = ap.parse_args()

    csv_path = master_csv_path()
    print(f"master: {os.path.basename(csv_path)}")
    with open(csv_path, encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames
        rows = list(reader)
    print(f"rows:   {len(rows)}")

    # csv line number = index + 2 (header occupies line 1)
    targets = [(i, i + 2, r) for i, r in enumerate(rows) if needs_backfill(r)]
    print(f"non-doi.org original_url rows: {len(targets)}\n")

    findings = {}  # line -> dict

    # ---- Tier A -----------------------------------------------------------
    for _, line, row in targets:
        doi, note = tier_a(row["original_url"])
        if doi:
            findings[line] = {"tier": "A", "doi": doi, "note": note,
                              "resolved_title": "", "resolved_journal": "", "resolved_year": ""}
    print(f"tier A (identifier in url): {len(findings)}")

    # ---- Tier B -----------------------------------------------------------
    pmid_rows = {}
    for _, line, row in targets:
        if line in findings:
            continue
        m = PMID_URL.search(row["original_url"])
        if m:
            pmid_rows.setdefault(m.group(1), []).append(line)
    pmid_map = pmid_to_doi_batch(sorted(pmid_rows))
    n_b = 0
    for pmid, lines in pmid_rows.items():
        if pmid in pmid_map:
            for line in lines:
                findings[line] = {"tier": "B", "doi": pmid_map[pmid],
                                  "note": f"pmid {pmid}", "resolved_title": "",
                                  "resolved_journal": "", "resolved_year": ""}
                n_b += 1
    print(f"tier B (pmid -> doi):       {n_b}  ({len(pmid_map)}/{len(pmid_rows)} pmids had a DOI)")

    # ---- Tier C -----------------------------------------------------------
    s2_rows = {}
    for _, line, row in targets:
        if line in findings:
            continue
        m = S2_HASH.search(row["original_url"])
        if m:
            s2_rows.setdefault(m.group(1).lower(), []).append(line)
    s2_map = s2_to_doi_batch(sorted(s2_rows))
    n_c = 0
    for h, lines in s2_rows.items():
        if h in s2_map:
            for line in lines:
                findings[line] = {"tier": "C", "doi": s2_map[h], "note": "semantic scholar id",
                                  "resolved_title": "", "resolved_journal": "", "resolved_year": ""}
                n_c += 1
    print(f"tier C (s2 hash -> doi):    {n_c}  ({len(s2_map)}/{len(s2_rows)} hashes had a DOI)")

    # ---- Tier D -----------------------------------------------------------
    n_d = 0
    misses = {}
    if not args.skip_tier_d:
        pending = [(line, row) for _, line, row in targets if line not in findings]
        print(f"\ntier D (title search) over {len(pending)} remaining rows:")
        for line, row in pending:
            title = (row.get("original_title") or "").strip()
            print(f"  L{line} {title[:62]!r}")
            doi, meta = tier_d(row)
            if doi:
                findings[line] = {
                    "tier": "D", "doi": doi, "note": "title match (gated)",
                    "resolved_title": (meta.get("title") or "").replace("\n", " ")[:120],
                    "resolved_journal": (meta.get("journal") or "")[:80],
                    "resolved_year": str(meta.get("year") or ""),
                }
                n_d += 1
                print(f"        -> {doi}")
            else:
                misses[line] = meta if isinstance(meta, str) else "no match"
                print(f"        -- {misses[line]}")
    print(f"\ntier D accepted: {n_d}")

    # ---- report -----------------------------------------------------------
    total = len(findings)
    with open(REPORT_PATH, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["csv_line", "tier", "confidence", "proposed_doi", "new_original_url",
                    "old_original_url", "csv_title", "csv_journal", "csv_year",
                    "resolved_title", "resolved_journal", "resolved_year", "note"])
        for _, line, row in targets:
            f = findings.get(line)
            if f:
                doi = _norm_doi(f["doi"])
                w.writerow([line, f["tier"],
                            "exact-id" if f["tier"] in "ABC" else "REVIEW-REQUIRED",
                            doi, f"https://doi.org/{doi}", row["original_url"],
                            row.get("original_title", "")[:120], row.get("original_journal", ""),
                            row.get("original_year", ""), f["resolved_title"],
                            f["resolved_journal"], f["resolved_year"], f["note"]])
            else:
                w.writerow([line, "-", "no-doi-found", "", "", row["original_url"],
                            row.get("original_title", "")[:120], row.get("original_journal", ""),
                            row.get("original_year", ""), "", "", "",
                            misses.get(line, "not attempted")])
    print(f"\nreport: {REPORT_PATH}")
    print(f"proposed DOIs: {total} / {len(targets)}  "
          f"(A={sum(1 for f in findings.values() if f['tier']=='A')} "
          f"B={sum(1 for f in findings.values() if f['tier']=='B')} "
          f"C={sum(1 for f in findings.values() if f['tier']=='C')} "
          f"D={n_d})")

    if not args.apply:
        print("\nDRY RUN - no files written. Review the report, then re-run with "
              "--apply --accept <file-of-line-numbers>.")
        return

    # ---- apply ------------------------------------------------------------
    accepted = None
    if args.accept:
        with open(args.accept, encoding="utf-8") as fh:
            accepted = {int(ln.split("#")[0].strip()) for ln in fh
                        if ln.split("#")[0].strip().isdigit()}
    # Every applied row must be explicitly listed. Nothing is written on the strength
    # of an automated match alone -- a wrong DOI silently misattributes a study.
    if accepted is None:
        raise SystemExit(
            "refusing to apply without --accept: pass a file listing the CSV line "
            "numbers you reviewed in the report.")
    unreviewed = set(findings) - accepted
    if unreviewed:
        print(f"  ({len(unreviewed)} proposed rows not in --accept; skipping them: "
              f"{sorted(unreviewed)})")

    changed = []
    for idx, line, row in targets:
        f = findings.get(line)
        if not f:
            continue
        if accepted is not None and line not in accepted:
            continue
        doi = _norm_doi(f["doi"])
        new_url = f"https://doi.org/{doi}"
        if _norm_doi(row.get("replication_url")) == doi:
            print(f"  SKIP L{line}: would equal replication_url (doi_self_pair)")
            continue
        rows[idx]["original_url"] = new_url
        changed.append((line, new_url))

    if not changed:
        print("nothing accepted; master untouched")
        return

    stamp = time.strftime("%Y_%m_%d_%H%M%S")
    out_name = f"replications_database_{stamp}.csv"
    out_path = os.path.join(DATA_DIR, out_name)
    with open(out_path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"\nwrote {out_name} ({len(changed)} original_url values updated)")
    print("NEXT: archive the superseded master to data/backup/ and append a "
          "version_history.txt line describing these changes.")


if __name__ == "__main__":
    main()
