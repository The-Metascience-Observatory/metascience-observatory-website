import requests
import time
import urllib.parse
import re
import logging
import os
from pathlib import Path
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# Load OpenAlex API key from environment
def _get_openalex_api_key():
    """Load OpenAlex API key from .env.local or environment"""
    api_key = os.getenv('OPENALEXAPIKEY')
    if not api_key:
        # Try to load from .env.local in parent directory
        try:
            env_path = Path(__file__).parent.parent / '.env.local'
            if env_path.exists():
                with open(env_path) as f:
                    for line in f:
                        if line.startswith('OPENALEXAPIKEY='):
                            api_key = line.strip().split('=', 1)[1]
                            break
        except Exception:
            pass
    return api_key


OPENALEX_API_KEY = _get_openalex_api_key()


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


def _title_similarity(query_title, fetched_title, threshold=0.6):
    """Return a similarity score (0-1) if titles match, or 0.0 if below threshold.

    Uses SequenceMatcher ratio as the primary metric, with secondary
    checks for substring containment and exact main-title matching.
    """
    if not query_title or not fetched_title:
        return 0.0
    a = query_title.lower().strip()
    b = fetched_title.lower().strip()
    ratio = SequenceMatcher(None, a, b).ratio()
    if ratio >= threshold:
        return ratio
    # Secondary check: if the main title (before colon/subtitle) of one
    # is contained in the other, accept it (handles "Title" vs "Title: Subtitle"
    # and "Title again" vs "Title" patterns common in replications)
    a_main = a.split(":")[0].strip()
    b_main = b.split(":")[0].strip()
    if len(a_main) >= 10 and len(b_main) >= 10:
        if a_main in b or b_main in a:
            logger.info(f"Title match via substring (ratio={ratio:.2f}): query='{query_title[:60]}' vs fetched='{fetched_title[:60]}'")
            return max(ratio, threshold)  # at least threshold so it qualifies
    # Exact match of main title (before colon)
    if a_main == b_main and len(a_main) >= 8:
        logger.info(f"Title match via exact main title: '{query_title[:60]}'")
        return max(ratio, threshold)
    return 0.0


def _titles_match(query_title, fetched_title, threshold=0.6):
    """Check if a fetched title is similar enough to the query title."""
    return _title_similarity(query_title, fetched_title, threshold) > 0.0


def _validate_metadata(fetched, expected_journal=None, expected_year=None, expected_volume=None):
    """
    Validate fetched metadata against expected values.
    Returns True if metadata matches or no expected values provided.
    Used for disambiguating generic titles.
    """
    if not fetched:
        return False

    # If we have expected values, check them
    checks_passed = 0
    checks_total = 0

    if expected_year:
        checks_total += 1
        fetched_year = str(fetched.get('year', '')).strip()
        if fetched_year and str(expected_year).strip() == fetched_year:
            checks_passed += 1
        elif not fetched_year:
            # No year in fetched data, don't penalize
            pass
        else:
            # Year mismatch - fail validation
            return False

    if expected_journal:
        checks_total += 1
        fetched_journal = str(fetched.get('journal', '')).lower().strip()
        expected_j = str(expected_journal).lower().strip()
        # Fuzzy match on journal name (allows "Am Econ Rev" vs "American Economic Review")
        if fetched_journal and (expected_j in fetched_journal or fetched_journal in expected_j):
            checks_passed += 1
        elif not fetched_journal:
            # No journal in fetched data, don't penalize
            pass
        else:
            # Journal mismatch - fail validation
            logger.debug(f"Journal mismatch: expected='{expected_journal}' vs fetched='{fetched.get('journal')}'")
            return False

    if expected_volume:
        checks_total += 1
        fetched_volume = str(fetched.get('volume', '')).strip()
        if fetched_volume and str(expected_volume).strip() == fetched_volume:
            checks_passed += 1
        elif not fetched_volume:
            # No volume in fetched data, don't penalize
            pass
        # Volume mismatch is not a hard failure (volumes can be inconsistent)

    # If we have expected values and at least one matched, consider it valid
    if checks_total > 0 and checks_passed > 0:
        return True
    # If no expected values provided, validation passes
    if checks_total == 0:
        return True

    return False


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

def fetch_metadata_from_title(title, email="your_email@example.com", delay=0.2, authors=None,
                             journal=None, year=None, volume=None):
    """
    Progressive multi-API metadata enrichment starting from a title.
    OpenAlex → Crossref → EuropePMC → Entrez/PubMed → DataCite → Semantic Scholar
    Attempts to find the DOI first, then uses DOI-based lookups to fill metadata.

    Args:
        authors: Optional author string (e.g. "Nass, C.; Moon, Y.") used to
                 improve Crossref search accuracy via query.author.
        journal: Optional journal name for validation when title is generic.
        year: Optional publication year for validation when title is generic.
        volume: Optional volume number for validation when title is generic.
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
        openalex_url = f"https://api.openalex.org/works?filter=title.search:{q}&per_page=5"
        if OPENALEX_API_KEY:
            openalex_url += f"&api_key={OPENALEX_API_KEY}"
        r = _request_with_retry(openalex_url, headers=headers)
        if r and r.status_code == 200:
            results = r.json().get("results", [])
            best_sim, best_data = 0.0, None
            for data in results[:5]:
                # Extract metadata for validation
                candidate_meta = {
                    'journal': data.get("host_venue", {}).get("display_name"),
                    'year': data.get("publication_year"),
                    'volume': data.get("biblio", {}).get("volume"),
                }
                # Skip if validation fails (journal/year/volume mismatch)
                if not _validate_metadata(candidate_meta, journal, year, volume):
                    continue
                sim = _title_similarity(title, data.get("title"))
                if sim > best_sim:
                    best_sim, best_data = sim, data
            if best_data:
                fetched_title = best_data.get("title")
                doi = normalize_doi(best_data.get("doi"))
                oa = {
                    "doi": doi,
                    "authors": "; ".join([a["author"]["display_name"] for a in best_data.get("authorships", [])]) or None,
                    "title": fetched_title,
                    "journal": best_data.get("host_venue", {}).get("display_name"),
                    "volume": best_data.get("biblio", {}).get("volume"),
                    "issue": best_data.get("biblio", {}).get("issue"),
                    "pages": best_data.get("biblio", {}).get("first_page"),
                    "year": best_data.get("publication_year"),
                    "url": f"https://doi.org/{doi}" if doi else best_data.get("host_venue", {}).get("url"),
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
            cr_url = f"https://api.crossref.org/works?query.title={q}&rows=5"
            # Add author filter if available (extract first surname)
            if authors:
                first_author = re.split(r"[;,]", authors)[0].strip()
                # Extract surname: handle "Last, F." and "First Last" formats
                surname = first_author.split(",")[0].strip() if "," in first_author else first_author.split()[-1] if first_author.split() else ""
                if surname and len(surname) >= 2:
                    cr_url += f"&query.author={urllib.parse.quote(surname)}"
            r = _request_with_retry(cr_url, headers=headers)
            if r and r.status_code == 200:
                items = r.json()["message"].get("items", [])
                best_sim, best_item = 0.0, None
                for item in items[:5]:
                    # Extract metadata for validation
                    item_year = (
                        item.get("published-print", {}).get("date-parts", [[None]])[0][0]
                        or item.get("published-online", {}).get("date-parts", [[None]])[0][0]
                    )
                    candidate_meta = {
                        'journal': (item.get("container-title") or [None])[0],
                        'year': item_year,
                        'volume': item.get("volume"),
                    }
                    # Skip if validation fails
                    if not _validate_metadata(candidate_meta, journal, year, volume):
                        continue
                    fetched_title = (item.get("title") or [None])[0]
                    sim = _title_similarity(title, fetched_title)
                    if sim > best_sim:
                        best_sim, best_item = sim, item
                if best_item:
                    fetched_title = (best_item.get("title") or [None])[0]
                    doi = normalize_doi(best_item.get("DOI"))
                    cr_authors = []
                    for a in best_item.get("author", []):
                        parts = []
                        if "given" in a: parts.append(a["given"])
                        if "family" in a: parts.append(a["family"])
                        name = " ".join(parts).strip()
                        if name:
                            cr_authors.append(name)
                    year = (
                        best_item.get("published-print", {}).get("date-parts", [[None]])[0][0]
                        or best_item.get("published-online", {}).get("date-parts", [[None]])[0][0]
                    )
                    cr = {
                        "doi": doi,
                        "authors": "; ".join(cr_authors) or None,
                        "title": fetched_title,
                        "journal": (best_item.get("container-title") or [None])[0],
                        "volume": best_item.get("volume"),
                        "issue": best_item.get("issue"),
                        "pages": best_item.get("page"),
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
                f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&format=json&pageSize=5",
            )
            if r and r.status_code == 200:
                results = r.json().get("resultList", {}).get("result", [])
                best_sim, best_d = 0.0, None
                for d in results[:5]:
                    # Extract metadata for validation
                    candidate_meta = {
                        'journal': d.get("journalTitle"),
                        'year': d.get("pubYear"),
                        'volume': d.get("journalVolume"),
                    }
                    # Skip if validation fails
                    if not _validate_metadata(candidate_meta, journal, year, volume):
                        continue
                    sim = _title_similarity(title, d.get("title"))
                    if sim > best_sim:
                        best_sim, best_d = sim, d
                if best_d:
                    fetched_title = best_d.get("title")
                    normalized_doi = normalize_doi(best_d.get("doi"))
                    ep = {
                        "doi": normalized_doi,
                        "authors": best_d.get("authorString"),
                        "title": fetched_title,
                        "journal": best_d.get("journalTitle"),
                        "volume": best_d.get("journalVolume"),
                        "issue": best_d.get("issue"),
                        "pages": best_d.get("pageInfo"),
                        "year": best_d.get("pubYear"),
                        "url": best_d.get("fullTextUrlList", {}).get("fullTextUrl", [{}])[0].get("url"),
                    }
                    meta = enrich(meta, ep)
                    doi = meta.get("doi")
                    if is_complete(meta):
                        return meta
            elif r:
                logger.warning(f"Europe PMC returned HTTP {r.status_code} for title search")
        except Exception as e:
            logger.warning(f"Europe PMC title search error: {e}")

    if not doi:
        # ---------- 4️⃣ NCBI Entrez/PubMed ----------
        try:
            from Bio import Entrez
            Entrez.email = email
            # Strict title field search first
            handle = Entrez.esearch(db="pubmed", term=f"{title}[Title]", retmax=3)
            search_results = Entrez.read(handle)
            handle.close()
            pmids = search_results.get("IdList", [])
            # Fall back to fuzzy full-text search if strict fails
            if not pmids:
                handle = Entrez.esearch(db="pubmed", term=title, retmax=3)
                search_results = Entrez.read(handle)
                handle.close()
                pmids = search_results.get("IdList", [])
            if pmids:
                handle = Entrez.efetch(db="pubmed", id=pmids[0], rettype="xml")
                records = Entrez.read(handle)
                handle.close()
                article = records["PubmedArticle"][0]["MedlineCitation"]["Article"]
                fetched_title = str(article.get("ArticleTitle", ""))
                if _titles_match(title, fetched_title):
                    # Extract DOI from ArticleIdList
                    id_list = records["PubmedArticle"][0].get("PubmedData", {}).get("ArticleIdList", [])
                    entrez_doi = None
                    for aid in id_list:
                        if aid.attributes.get("IdType") == "doi":
                            entrez_doi = normalize_doi(str(aid))
                            break
                    # Extract metadata
                    journal_info = article.get("Journal", {})
                    pub_date = journal_info.get("JournalIssue", {}).get("PubDate", {})
                    authors_list = []
                    for author in article.get("AuthorList", []):
                        last = author.get("LastName", "")
                        fore = author.get("ForeName", "")
                        if last:
                            authors_list.append(f"{fore} {last}".strip())
                    ez = {
                        "doi": entrez_doi,
                        "authors": "; ".join(authors_list) or None,
                        "title": fetched_title,
                        "journal": journal_info.get("Title"),
                        "volume": journal_info.get("JournalIssue", {}).get("Volume"),
                        "issue": journal_info.get("JournalIssue", {}).get("Issue"),
                        "pages": article.get("Pagination", {}).get("StartPage") or article.get("Pagination", {}).get("MedlinePgn"),
                        "year": pub_date.get("Year"),
                        "url": f"https://doi.org/{entrez_doi}" if entrez_doi else None,
                    }
                    meta = enrich(meta, ez)
                    doi = meta.get("doi")
                    if is_complete(meta):
                        return meta
        except ImportError:
            logger.debug("Biopython not installed, skipping Entrez search")
        except Exception as e:
            logger.warning(f"Entrez/PubMed search error: {e}")
        time.sleep(delay)

    # ---------- 5️⃣ DataCite (if DOI found) ----------
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

    # ---------- 6️⃣ Semantic Scholar (if DOI or title available) ----------
    try:
        if doi:
            url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=title,year,venue,url,authors"
            r = _request_with_retry(url, headers=headers)
            if r and r.status_code == 200:
                s = r.json()
                fetched_title = s.get("title")
                ss = {
                    "doi": doi,
                    "authors": "; ".join(a.get("name", "") for a in s.get("authors", [])) or None,
                    "title": fetched_title,
                    "journal": s.get("venue"),
                    "year": s.get("year"),
                    "url": s.get("url") or f"https://doi.org/{doi}",
                }
                meta = enrich(meta, ss)
            elif r:
                logger.warning(f"Semantic Scholar returned HTTP {r.status_code} for DOI query")
        else:
            q = urllib.parse.quote(title)
            url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={q}&limit=5&fields=title,year,venue,url,authors,externalIds"
            r = _request_with_retry(url, headers=headers)
            if r and r.status_code == 200:
                data = r.json()
                best_sim, best_s = 0.0, None
                for s in data.get("data", [])[:5]:
                    sim = _title_similarity(title, s.get("title"))
                    if sim > best_sim:
                        best_sim, best_s = sim, s
                if best_s:
                    fetched_doi = normalize_doi((best_s.get("externalIds", {}) or {}).get("DOI"))
                    doi = fetched_doi
                    ss = {
                        "doi": doi,
                        "authors": "; ".join(a.get("name", "") for a in best_s.get("authors", [])) or None,
                        "title": best_s.get("title"),
                        "journal": best_s.get("venue"),
                        "year": best_s.get("year"),
                        "url": best_s.get("url") or (f"https://doi.org/{doi}" if doi else None),
                    }
                    meta = enrich(meta, ss)
            elif r:
                logger.warning(f"Semantic Scholar returned HTTP {r.status_code} for title query")
    except Exception as e:
        logger.warning(f"Semantic Scholar error: {e}")

    # ---------- Default fallback ----------
    if meta.get("doi") and not meta.get("url"):
        meta["url"] = f"https://doi.org/{meta['doi']}"
    return meta
