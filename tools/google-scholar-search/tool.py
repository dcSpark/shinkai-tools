# /// script
# dependencies = [
#   "requests",
#   "scholarly",
#   "beautifulsoup4",
# ]
# ///

from typing import Any, Optional, List, Dict
import re

from scholarly import scholarly
from bs4 import BeautifulSoup
import requests
from requests import RequestException

class CONFIG:
    # Maximum number of results to return (applies to both methods)
    max_results: int = 10
    # User-Agent header for web scraping fallback (can be overridden)
    user_agent: Optional[str] = "Mozilla/5.0 (compatible; GoogleScholarBot/1.0; +https://scholar.google.com/)"
    # Timeout (seconds) for HTTP requests in fallback
    timeout: int = 30

class INPUTS:
    # Query string to search (used by Scholarly and scraping)
    query: str
    # Optional year bounds for scholarly.search_pubs
    year_low: Optional[int] = None
    year_high: Optional[int] = None

class OUTPUT:
    results: List[Dict[str, Any]]
    search_method_used: Optional[str] = None  # "scholarly library" or "web scraping"
    scholarly_error: Optional[str] = None
    scraping_error: Optional[str] = None
    instructions_to_show_results: Optional[str] = None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.results = []
    output.search_method_used = None
    output.scholarly_error = None
    output.scraping_error = None
    # Hardcoded instruction string as requested (keeps original phrasing)
    output.instructions_to_show_results = "When showing the search results to the user, include all relevant details per publication, including clickage links to the publication."

    # Helper: unified schema keys (note: 'snippet' used instead of 'abstract')
    def make_unified_record(
        title: Optional[str] = None,
        authors: Optional[Any] = None,
        snippet: Optional[str] = None,
        year: Optional[Any] = None,
        venue: Optional[str] = None,
        pub_url: Optional[str] = None,
        num_citations: Optional[Any] = None,
        author_id: Optional[Any] = None,
        eprint_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        return {
            "title": title,
            "authors": authors,
            "snippet": snippet,
            "year": year,
            "venue": venue,
            "pub_url": pub_url,
            "num_citations": num_citations,
            "author_id": author_id,
            "eprint_url": eprint_url,
        }

    # First attempt: use scholarly library
    try:
        scholarly_results: List[Dict[str, Any]] = []
        pub_iter = scholarly.search_pubs(
            inputs.query,
            year_low=inputs.year_low,
            year_high=inputs.year_high
        )
        for i, pub in enumerate(pub_iter):
            if i >= config.max_results:
                break
            # Robust extraction of bib/info
            try:
                bib = pub.get("bib", {}) if hasattr(pub, "get") else (getattr(pub, "bib", {}) or {})
            except Exception:
                bib = {}
            def safe_get(obj, key):
                try:
                    if isinstance(obj, dict):
                        return obj.get(key)
                    return getattr(obj, key, None)
                except Exception:
                    return None

            title = safe_get(bib, "title")
            authors = safe_get(bib, "author")
            abstract = safe_get(bib, "abstract")  # map this to snippet below
            year = safe_get(bib, "pub_year") or safe_get(bib, "year")
            venue = safe_get(bib, "venue") or safe_get(bib, "journal")
            pub_url = safe_get(pub, "pub_url")
            num_citations = safe_get(pub, "num_citations")
            author_id = safe_get(pub, "author_id")
            eprint_url = safe_get(pub, "eprint_url")

            scholarly_results.append(make_unified_record(
                title=title,
                authors=authors,
                snippet=abstract,  # map scholarly abstract -> unified snippet
                year=year,
                venue=venue,
                pub_url=pub_url,
                num_citations=num_citations,
                author_id=author_id,
                eprint_url=eprint_url,
            ))

        if scholarly_results:
            output.results = scholarly_results
            output.search_method_used = "scholarly library"
            return output
        output.scholarly_error = "Scholarly returned no results."
    except Exception as e:
        output.scholarly_error = str(e)

    # Fallback: web scraping Google Scholar
    try:
        base_url = "https://scholar.google.com/scholar"
        params = {"q": inputs.query, "hl": "en"}
        headers = {"User-Agent": config.user_agent} if config.user_agent else {}
        resp = requests.get(base_url, params=params, headers=headers, timeout=config.timeout)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        result_divs = soup.find_all("div", class_="gs_ri")
        scraping_results: List[Dict[str, Any]] = []
        for div in result_divs[:config.max_results]:
            title_tag = div.find("h3", class_="gs_rt")
            title = None
            link = None
            if title_tag:
                a_tag = title_tag.find("a")
                if a_tag:
                    title = a_tag.get_text().strip()
                    link = a_tag.get("href", None)
                else:
                    title = title_tag.get_text().strip()
                    link = None
            author_tag = div.find("div", class_="gs_a")
            authors = author_tag.get_text().strip() if author_tag else None
            snippet_tag = div.find("div", class_="gs_rs")
            snippet = snippet_tag.get_text().strip() if snippet_tag else None
            year = None
            if authors:
                m = re.search(r'\b(19|20)\d{2}\b', authors)
                if m:
                    year = m.group(0)

            # Map scraping fields into unified schema:
            # - snippet -> snippet (already)
            # - link -> pub_url
            # - venue, num_citations, author_id, eprint_url -> None (not available via simple scraping)
            scraping_results.append(make_unified_record(
                title=title,
                authors=authors,
                snippet=snippet,
                year=year,
                venue=None,
                pub_url=link,
                num_citations=None,
                author_id=None,
                eprint_url=None,
            ))

        if scraping_results:
            output.results = scraping_results
            output.search_method_used = "web scraping"
            return output
        output.scraping_error = "Scraping returned no results."
    except RequestException as e:
        output.scraping_error = f"Network error: {str(e)}"
    except Exception as e:
        output.scraping_error = f"Unexpected error: {str(e)}"

    # Both methods failed or returned no results
    return output