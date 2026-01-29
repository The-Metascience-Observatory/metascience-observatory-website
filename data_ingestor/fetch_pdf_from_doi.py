import os
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
#from paperscraper.pdf import save_pdf
from ddgs import DDGS
from fetch_metadata_from_doi import fetch_metadata_from_doi


api_keys = {
"ELSEVIER_TDM_API_KEY": "2709a2050ebc9a7fa45e2575531b9e66"
}

headers = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "application/pdf,application/octet-stream,"
        "application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "",   # IMPORTANT: helps if PDF requires same-site referer
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
}

#-----------------------------------------------------------------------------------------
def try_download(url, save_path):
    """Try downloading PDF from URL and save to save_path."""

    if not url:
        return False

    headers['Referer'] = url
    
    try:

        try:
            r = requests.get(
                url,
                headers=headers,
                timeout=20,
                allow_redirects=True,
                stream=True
            )
        except SSLError as e:
            print("SSL verification failed, retrying with verify=False (INSECURE):", e)
            r = requests.get(
                url,
                headers=headers,
                timeout=25,
                allow_redirects=True,
                stream=True,
                verify=False,        # last-resort bypass
            )

        content_type = r.headers.get("content-type", "").lower()
        if r.status_code == 200 and "pdf" in content_type:
            with open(save_path, "wb") as f:
                for chunk in r.iter_content(8192):
                    if chunk:
                        f.write(chunk)
            print("PDF downloaded OK from direct URL.")
            return True
        else:
            print(f"Got status={r.status_code}, content-type={content_type}")
    except Exception as e:
        print(f"Failed downloading from {url}: {e}")
    return False
    

#-----------------------------------------------------------------------------------------
def download_pdf_from_scihub(doi: str, save_path: str):

    #"https://sci-hub.ru/", 

    page_url = "https://sci-hub.se/" + doi
    
    
    session = requests.Session()

    # 1. Fetch the page
    resp = session.get(page_url)
    resp.raise_for_status()

    # If we already got a PDF, just save it
    content_type = resp.headers.get("Content-Type", "").lower()
    if "pdf" in content_type:
        with open(save_path, "wb") as f:
            f.write(resp.content)
        print(f"Saved PDF directly from {page_url} -> {save_path}")
        return

    # 2. Parse HTML to find the <embed type="application/pdf"> tag
    soup = BeautifulSoup(resp.text, "html.parser")
    embed = soup.find("embed", {"type": "application/pdf"})
    if not embed or not embed.get("src"):
        raise RuntimeError(f"Could not find embedded PDF in page for {page_url}")

    pdf_src = embed["src"]

    # Handle URLs like //2024.example.com/file.pdf
    pdf_url = urljoin(page_url, pdf_src)

    # 3. Download the real PDF
    pdf_resp = session.get(pdf_url, stream=True)
    pdf_resp.raise_for_status()

    with open(save_path, "wb") as f:
        for chunk in pdf_resp.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    
    return None


#-----------------------------------------------------------------------------------------
def fetch_pdf_from_doi(doi,
                       save_path,
                       email="delton17@gmail.com", 
                       verbose=False, 
                       delay=0.1
                      ):
    """
    Try to download a PDF for a DOI using multiple fallbacks:
      0. OSF  if identified as OSF DOI
      1. Semantic Scholar
      2. OpenAlex
      3. Unpaywall
      4. Crossref (direct PDF links or landing page)
      5. Europe PMC
      6. Direct DOI resolver (html scraping)

    Saves PDF to save_dir as: doi.replace('/', '--') + '.pdf'
    Returns the path if successful, else None.
    """

    doi = doi.strip().lower()
    
    if not isinstance(doi, str) or not doi.strip():
        print(f"ERROR with doi: {doi}")
        return None

    if os.path.exists(save_path):
        print(f"WARNING: Already have {save_path}")

    time.sleep(delay)

    # ---------------- 0  OSF DOI handling ----------------
    if doi.lower().startswith("10.17605/osf.io") or "osf" in doi.lower():
        try:
            # Normalize DOI → OSF identifier
            osf_id = doi.split("/")[-1].replace("%2F", "").replace("OSF.IO", "").strip().lower()
            if not osf_id:
                osf_id = re.findall(r"osf\.io/([a-z0-9]+)", doi.lower())
                osf_id = osf_id[0] if osf_id else None

            if osf_id:
                # Try the simple direct download first
                candidate_urls = [
                    f"https://osf.io/{osf_id}/download",
                    f"https://osf.io/{osf_id}/?action=download",
                    f"https://osf.io/{osf_id}/",
                ]

                for url in candidate_urls:
                    if try_download(url, save_path):
                        print(f"✅ OSF direct download success for {doi}")
                        return save_path

                # Try the OSF API (to find attached files)
                r = requests.get(f"https://api.osf.io/v2/nodes/{osf_id}/files/", timeout=10)
                if r.status_code == 200:
                    files_json = r.json()
                    for entry in files_json.get("data", []):
                        links = entry.get("links", {})
                        pdf_url = links.get("download")
                        if pdf_url and pdf_url.lower().endswith(".pdf"):
                            if try_download(pdf_url, save_path):
                                print(f"✅ OSF API file download success for {doi}")
                                return save_path
        except Exception as e:
            print(f"⚠️ OSF download failed for {doi}: {e}")
            pass

    # ---------------- Science Magazine special handling ----------------
    #if "science" in doi:
    #    try:
    #        url = "https://www.science.org/doi/" + doi            
    #        download_pdf_from_science(url, save_path)
    #    except Exception as e:
    #        print(f"⚠️ Science download failed for {doi}: {e}")
    #        pass


    
    # ----------------OpenAlex ----------------
    try:
        r = requests.get(f"https://api.openalex.org/works/https://doi.org/{doi}", timeout=10)
        if r.status_code == 200:
            data = r.json()
            best = data.get("best_oa_location") or {}
            pdf_url = best.get("url_for_pdf") or best.get("url")
            if try_download(pdf_url, save_path):
                if (verbose): print(f"✅ OpenAlex success for {doi}")
                return save_path
        else:
            print("openalex status code", r)
                
    except Exception as e:
        if (verbose): print(f"Error with OpenAlex: {e}")
        pass


    # ----------------  Semantic Scholar ----------------
    try:
        r = requests.get(
            f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=openAccessPdf",
            timeout=10,
        )
        if r.status_code == 200:
            pdf_url = r.json().get("openAccessPdf", {}).get("url")
            if try_download(pdf_url, save_path):
                if (verbose): print(f"✅ Semantic Scholar success for {doi}")
                return save_path
    except Exception as e:
        if (verbose): print(f"Error with Semantic Scholar: {e}")
        pass

    # ---------------- Unpaywall ----------------
    try:
        r = requests.get(f"https://api.unpaywall.org/v2/{doi}?email={email}", timeout=10)
        if r.status_code == 200:
            data = r.json()
            best = data.get("best_oa_location") or {}
            pdf_url = best.get("url_for_pdf") or best.get("url")
            if try_download(pdf_url, save_path):
                if (verbose): print(f"✅ Unpaywall success for {doi}")
                return save_path
    except Exception as e: 
        if (verbose): print(f"Error with Unpaywall: {e}")
        pass

    # ----------------  Crossref ----------------
    try:
        r = requests.get(f"https://api.crossref.org/works/{doi}", timeout=10)
        if r.status_code == 200:
            m = r.json().get("message", {})
            # Direct PDF links in Crossref metadata
            for link in m.get("link", []):
                if link.get("content-type") == "application/pdf":
                    if try_download(link.get("URL"), save_path):
                        if (verbose): print(f"✅ Crossref direct link success for {doi}")
                        return save_path
            # Landing page fallback
            landing = m.get("URL")
            if try_download(landing, save_path):
                if (verbose): print(f"✅ Crossref landing page worked for {doi}")
                return save_path
    except Exception as e:
        if (verbose): print(f"Error with Crossref: {e}")
        pass

    # ----------------  Europe PMC ----------------
    try:
        r = requests.get(
            f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:{doi}&format=json",
            timeout=10,
        )
        if r.status_code == 200:
            results = r.json().get("resultList", {}).get("result", [])
            if results:
                full_urls = results[0].get("fullTextUrlList", {}).get("fullTextUrl", [])
                for u in full_urls:
                    if "pdf" in (u.get("url", "").lower()):
                        if try_download(u["url"], save_path):
                            if (verbose): print(f"✅ EuropePMC success for {doi}")
                            return save_path
    except Exception as e:
        if (verbose): print(f"Error with Europe PMC: {e}")
        pass


    # ------------- Duck duck go search for PDFs ---------------
    try:
        query = doi + " pdf"  

        md = fetch_metadata_from_doi(doi)
        title = md['title']
    
        results = DDGS().text(query, max_results=30)

        for r in results: 
            ddg_title = r['title'].replace("...", "")
            url = r['href']
            if ddg_title in title: 
                if ".pdf" in url:
                    if try_download(url, save_path):
                        print("------------------- YOU MAY WANT TO CHECK THIS!! -----------")
                        print(f"Succesfully downloaded {title} from DuckDuckGo")
                        return save_path

    except Exception as e:
        if (verbose): print(f"Error with duck duck go: {e}")
        pass             

    # ---------------- paper scraper----------------
    #try:
    #    paper_data = {'doi': doi}
    #    save_pdf(paper_data, 
    #            filepath=save_path,
    #            api_keys=api_keys,
    #            )

        #api_keys: Either a dictionary containing API keys (if already loaded) or a string (path to API keys file).
        #         If None, will try to load from `.env` file and if unsuccessful, skip API-based fallbacks.
    #except Exception as e:
    #    if (verbose): print(f"Error with Paper Scraper: {e}")
    #    pass  

    # ---------------- Direct DOI resolver ----------------
    try:
        resolved_url = f"https://doi.org/{doi}"
        headers['Referer'] = resolved_url
        r = requests.get(resolved_url, headers=headers, timeout=20, allow_redirects=True)
        if r.status_code == 200:
            # Direct PDF response
            if "application/pdf" in r.headers.get("content-type", "").lower():
                with open(save_path, "wb") as f:
                    f.write(r.content)
                if (verbose):  print(f"✅ Direct DOI PDF success for {doi}")
                return save_path

            # Search HTML for .pdf links
            pdf_links = re.findall(r'href=["\'](.*?\.pdf)["\']', r.text, re.IGNORECASE)
            for link in pdf_links:
                if link.startswith("/"):
                    base = re.match(r"^https?://[^/]+", r.url)
                    if base:
                        link = base.group(0) + link
                if try_download(link, save_path):
                    if (verbose): print(f"✅ Found PDF via DOI HTML for {doi}")
                    return save_path
                    
    except Exception as e:
        if (verbose): print(f"Error with Direct DOI: {e}")
        pass

    # ---------------- Sci-hub ----------------
    try:
        download_pdf_from_scihub(doi, save_path)
    except Exception as e:
        if (verbose): print(f"Error with sci-hub: {e}")
        pass
            
    print(f"!?!?!? Nothing worked 🙃🙃🙃 for {doi}")

