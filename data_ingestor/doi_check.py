"""Registry check of original-study DOIs at the ingest gate (2026-10-20).

A Crossref + doi.org audit of the published database (replications_database_
2026_10_01_130503.csv) found 43 rows whose original_url was a DOI that does not
exist or belongs to another paper: near-misses written from memory by an
extractor, typos printed in the citing paper, GROBID-truncated DOIs, and a
URL-encoded "%2F" whose "%" was lost. 28 of them came in through imports, which
the extraction pipeline never sees, so the check belongs here.

For each distinct original DOI in an incoming batch:

  doi_unregistered  (reject) doi.org has no record of it (HTTP 404). Confirmed
                    against the resolver itself, so a Crossref outage or a
                    DataCite/mEDRA DOI is never mistaken for a missing one.
  doi_title_mismatch (flag) the DOI is registered, but to a title that does not
                    match the row's original_title.

A lookup that fails (network) yields no violation: the check never blocks a row
on an unanswered question. The validator itself (validation_rules.py) stays
offline; this module is the gate's only network check and is skipped with
--skip-api-calls.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher

from validation_rules import Violation

MAILTO = "dan@metascienceobservatory.org"
_DOI_RE = re.compile(r"10\.\d{4,9}/[^\s\"']+")


def decode_doi(value) -> str | None:
    """The bare DOI in a URL or string, URL-decoded ("%2F" -> "/"), or None."""
    if not isinstance(value, str) or not value.strip():
        return None
    m = _DOI_RE.search(urllib.parse.unquote(value.strip()))
    if not m:
        return None
    d = m.group(0).rstrip(".,;]")
    while d.endswith(")") and d.count(")") > d.count("("):   # keep "(2001/052)"
        d = d[:-1].rstrip(".,;]")
    return d


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def resolve(doi: str) -> dict:
    """{'status': 'registered'|'unregistered'|'unknown', 'title': str}."""
    enc = urllib.parse.quote(doi, safe="")
    title = ""
    try:
        with urllib.request.urlopen(f"https://api.crossref.org/works/{enc}?mailto={MAILTO}", timeout=30) as r:
            title = ((json.load(r).get("message") or {}).get("title") or [""])[0]
            return {"status": "registered", "title": title}
    except urllib.error.HTTPError as e:
        if e.code != 404:
            return {"status": "unknown", "title": ""}
    except Exception:  # noqa: BLE001 - network: no verdict
        return {"status": "unknown", "title": ""}
    # Not in Crossref: ask the resolver itself (DataCite, mEDRA, ... or nothing).
    opener = urllib.request.build_opener(_NoRedirect)
    prefix, _, suffix = doi.partition("/")
    url = f"https://doi.org/{prefix}/{urllib.parse.quote(suffix, safe='')}"
    try:
        opener.open(urllib.request.Request(url, method="HEAD"), timeout=30)
        return {"status": "registered", "title": ""}
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            return {"status": "registered", "title": ""}
        if e.code == 404:
            return {"status": "unregistered", "title": ""}
    except Exception:  # noqa: BLE001
        pass
    return {"status": "unknown", "title": ""}


def _plain(t) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", str(t or "").lower()).split())


def titles_agree(row_title, registered_title) -> bool:
    """Lenient on purpose (a flag, not a reject): punctuation and case folded;
    a registry title that is the row's main title (subtitle dropped) agrees;
    so does near-complete word overlap or SequenceMatcher >= 0.6, the
    threshold sanity_check_metadata uses."""
    a, b = _plain(row_title), _plain(registered_title)
    if not a or not b:
        return True
    if a.startswith(b) or b.startswith(a):
        return True
    ta, tb = set(a.split()), set(b.split())
    if min(len(ta), len(tb)) >= 4 and len(ta & tb) / min(len(ta), len(tb)) >= 0.9:
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.6


def check_original_dois(df, resolver=resolve, delay: float = 0.1) -> list:
    """[(df index, [Violation])] for rows whose original DOI fails the check."""
    verdicts: dict[str, dict] = {}
    out = []
    for idx, row in df.iterrows():
        raw = row.get("original_url")
        doi = decode_doi(raw)       # None for PubMed/other URLs and blanks
        if not doi:
            continue
        key = doi.lower()
        if key not in verdicts:
            verdicts[key] = resolver(doi)
            time.sleep(delay)
        v = verdicts[key]
        if v["status"] == "unregistered":
            out.append((idx, [Violation("doi_unregistered", "original_url", str(raw), "reject",
                                        "DOI is not registered (doi.org 404); find the right DOI or blank it")]))
        elif v["status"] == "registered" and v["title"] and \
                not titles_agree(row.get("original_title"), v["title"]):
            out.append((idx, [Violation("doi_title_mismatch", "original_url", str(raw), "flag",
                                        f"DOI is registered to a different title: {v['title'][:90]!r}")]))
    return out
