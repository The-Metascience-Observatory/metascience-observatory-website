import requests
import time
import urllib.parse
import re
import logging
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


def _request_with_retry(url, headers=None, timeout=10, max_retries=3):
    """Make an HTTP GET request with exponential backoff on transient failures."""
    for attempt in range(max_retries):
        try:
            r = requests.get(url, timeout=timeout, headers=headers)
            if r.status_code == 429 or r.status_code >= 500:
                wait = 2 ** attempt
                logger.warning(f"HTTP {r.status_code} from {url}, retrying in {wait}s (attempt {attempt+1}/{max_retries})")
                time.sleep(wait)
                continue
            return r
        except requests.exceptions.RequestException as e:
            wait = 2 ** attempt
            logger.warning(f"Request error for {url}: {e}, retrying in {wait}s (attempt {attempt+1}/{max_retries})")
            time.sleep(wait)
    return None


def _titles_match(query_title, fetched_title, threshold=0.6):
    """Check if a fetched title is similar enough to the query title."""
    if not query_title or not fetched_title:
        return False
    a = query_title.lower().strip()
    b = fetched_title.lower().strip()
    ratio = SequenceMatcher(None, a, b).ratio()
    if ratio < threshold:
        logger.warning(f"Title mismatch (similarity={ratio:.2f}): query='{query_title[:60]}' vs fetched='{fetched_title[:60]}'")
        return False
    return True


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

def fetch_metadata_from_title(title, email="your_email@example.com", delay=0.2):
    """
    Progressive multi-API metadata enrichment starting from a title.
    OpenAlex → Crossref → DataCite → EuropePMC → Semantic Scholar
    Attempts to find the DOI first, then uses DOI-based lookups to fill metadata.
    """
    if not isinstance(title, str) or not title.strip():
        return None


    title = re.sub(r"\(\s*\d{4}\s*\)", "", title)       # remove "(YYYY)"
    title = re.sub(r"[\s\-\.,:;]+$", "", title).strip()  # trim extra punctuation/ and leading/trailing spaces

    headers = {
        # Pure Chrome-on-Windows user-agent (spoof)
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/117.0.0.0 Safari/537.36"
        )
    }


    meta = {k: None for k in ["doi", "authors", "title", "journal", "volume", "issue", "pages", "year", "url"]}

    def enrich(current, new):
        if not new:
            return current
        for k, v in new.items():
            if (current.get(k) in [None, "", "NaN"]) and (v not in [None, "", "NaN"]):
                current[k] = v
        return current

    def is_complete(m):
        return all(m.get(k) not in [None, "", "NaN"] for k in m)

    # ---------- 1️⃣ OpenAlex search by title ----------
    try:
        q = urllib.parse.quote(title)
        r = _request_with_retry(f"https://api.openalex.org/works?filter=title.search:{q}", headers=headers)
        if r and r.status_code == 200:
            results = r.json().get("results", [])
            if results:
                data = results[0]
                fetched_title = data.get("title")
                if _titles_match(title, fetched_title):
                    # OpenAlex returns DOI as full URL, normalize it
                    doi = normalize_doi(data.get("doi"))
                    oa = {
                        "doi": doi,
                        "authors": "; ".join([a["author"]["display_name"] for a in data.get("authorships", [])]) or None,
                        "title": fetched_title,
                        "journal": data.get("host_venue", {}).get("display_name"),
                        "volume": data.get("biblio", {}).get("volume"),
                        "issue": data.get("biblio", {}).get("issue"),
                        "pages": data.get("biblio", {}).get("first_page"),
                        "year": data.get("publication_year"),
                        "url": f"https://doi.org/{doi}" if doi else data.get("host_venue", {}).get("url"),
                    }
                    meta = enrich(meta, oa)
                    if is_complete(meta):
                        return meta
        elif r:
            logger.warning(f"OpenAlex returned HTTP {r.status_code} for title search")
    except Exception as e:
        logger.warning(f"OpenAlex title search error: {e}")
    time.sleep(delay)

    doi = meta.get("doi")
    if not doi:
        # ---------- 2️⃣ Try Crossref title search ----------
        try:
            q = urllib.parse.quote(title)
            r = _request_with_retry(f"https://api.crossref.org/works?query.title={q}&rows=1", headers=headers)
            if r and r.status_code == 200:
                items = r.json()["message"].get("items", [])
                if items:
                    item = items[0]
                    fetched_title = (item.get("title") or [None])[0]
                    if _titles_match(title, fetched_title):
                        # Normalize DOI just in case it contains URL prefix
                        doi = normalize_doi(item.get("DOI"))
                        authors = []
                        for a in item.get("author", []):
                            parts = []
                            if "given" in a: parts.append(a["given"])
                            if "family" in a: parts.append(a["family"])
                            name = " ".join(parts).strip()
                            if name:
                                authors.append(name)
                        year = (
                            item.get("published-print", {}).get("date-parts", [[None]])[0][0]
                            or item.get("published-online", {}).get("date-parts", [[None]])[0][0]
                        )
                        cr = {
                            "doi": doi,
                            "authors": "; ".join(authors) or None,
                            "title": fetched_title,
                            "journal": (item.get("container-title") or [None])[0],
                            "volume": item.get("volume"),
                            "issue": item.get("issue"),
                            "pages": item.get("page"),
                            "year": year,
                            "url": f"https://doi.org/{doi}" if doi else None,
                        }
                        meta = enrich(meta, cr)
                        if is_complete(meta):
                            return meta
            elif r:
                logger.warning(f"Crossref returned HTTP {r.status_code} for title search")
        except Exception as e:
            logger.warning(f"Crossref title search error: {e}")

    if not doi:
        # ---------- 3️⃣ Europe PMC fallback ----------
        try:
            q = urllib.parse.quote(title)
            r = _request_with_retry(
                f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&format=json&pageSize=1",
            )
            if r and r.status_code == 200:
                results = r.json().get("resultList", {}).get("result", [])
                if results:
                    d = results[0]
                    fetched_title = d.get("title")
                    if _titles_match(title, fetched_title):
                        # Normalize DOI just in case
                        normalized_doi = normalize_doi(d.get("doi"))
                        ep = {
                            "doi": normalized_doi,
                            "authors": d.get("authorString"),
                            "title": fetched_title,
                            "journal": d.get("journalTitle"),
                            "volume": d.get("journalVolume"),
                            "issue": d.get("issue"),
                            "pages": d.get("pageInfo"),
                            "year": d.get("pubYear"),
                            "url": d.get("fullTextUrlList", {}).get("fullTextUrl", [{}])[0].get("url"),
                        }
                        meta = enrich(meta, ep)
                        doi = meta.get("doi")
                        if is_complete(meta):
                            return meta
            elif r:
                logger.warning(f"Europe PMC returned HTTP {r.status_code} for title search")
        except Exception as e:
            logger.warning(f"Europe PMC title search error: {e}")

    # ---------- 4️⃣ DataCite (if DOI found) ----------
    if doi:
        try:
            r = _request_with_retry(f"https://api.datacite.org/dois/{doi.lower()}", headers=headers)
            if r and r.status_code == 200:
                d = r.json().get("data", {}).get("attributes", {})
                authors = []
                for a in d.get("creators", []):
                    name = a.get("name") or f"{a.get('givenName','')} {a.get('familyName','')}".strip()
                    if name:
                        authors.append(name)
                # Use container title if available; publisher is not the journal
                container = d.get("container", {}) or {}
                journal = container.get("title") or None
                dc = {
                    "authors": "; ".join(authors) or None,
                    "title": (d.get("titles") or [{}])[0].get("title"),
                    "journal": journal,
                    "year": d.get("publicationYear"),
                    "url": d.get("url") or f"https://doi.org/{doi}",
                }
                meta = enrich(meta, dc)
                if is_complete(meta):
                    return meta
            elif r:
                logger.warning(f"DataCite returned HTTP {r.status_code} for DOI {doi}")
        except Exception as e:
            logger.warning(f"DataCite error for DOI {doi}: {e}")

    # ---------- 5️⃣ Semantic Scholar (if DOI or title available) ----------
    try:
        if doi:
            url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=title,year,venue,url,authors"
        else:
            q = urllib.parse.quote(title)
            url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={q}&limit=1&fields=title,year,venue,url,authors,externalIds"
        r = _request_with_retry(url, headers=headers)
        if r and r.status_code == 200:
            data = r.json()
            s = data.get("data", [{}])[0] if "data" in data else data
            fetched_title = s.get("title")
            # Only validate title match for title-based searches (not DOI lookups)
            if doi or _titles_match(title, fetched_title):
                # Normalize DOI from external IDs or existing DOI
                fetched_doi = normalize_doi((s.get("externalIds", {}) or {}).get("DOI"))
                doi = doi or fetched_doi
                ss = {
                    "doi": doi,
                    "authors": "; ".join(a.get("name", "") for a in s.get("authors", [])) or None,
                    "title": fetched_title,
                    "journal": s.get("venue"),
                    "year": s.get("year"),
                    "url": s.get("url") or (f"https://doi.org/{doi}" if doi else None),
                }
                meta = enrich(meta, ss)
        elif r:
            logger.warning(f"Semantic Scholar returned HTTP {r.status_code} for query")
    except Exception as e:
        logger.warning(f"Semantic Scholar error: {e}")

    # ---------- Default fallback ----------
    if meta.get("doi") and not meta.get("url"):
        meta["url"] = f"https://doi.org/{meta['doi']}"
    return meta
