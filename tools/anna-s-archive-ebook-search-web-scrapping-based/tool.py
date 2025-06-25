# /// script
# dependencies = [
#   "requests",
#   "beautifulsoup4",
# ]
# ///

from typing import Any, Optional, List, Dict
import re

from bs4 import BeautifulSoup
import requests

class CONFIG:
    pass

class INPUTS:
    search_query: Optional[str] = None  # (str) Book title, author, etc. Required.
    file_type: Optional[str] = None     # (str) "pdf", "epub", "cbr", "cbz", None for all. Default: None
    sort: Optional[str] = None          # (str) "newest", "oldest", "largest", "smallest", None/"". Default: None
    category: Optional[str] = None      # (str) "", "book_any", "book_unknown", "book_fiction", "book_nonfiction", "book_comic", "magazine", "standards_document", "journal_article". Default: None

class OUTPUT:
    results: Optional[List[dict]] = None
    error: Optional[str] = None
    output_reading_instructions: Optional[str] = None

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36"
)
BASE_URL = "https://annas-archive.org"

def _book_search_url(
    query: str,
    file_type: Optional[str]=None,
    sort: Optional[str]=None,
    category: Optional[str]=None,
) -> str:
    q = query.replace(" ", "+")
    params = []
    if category and category != "":
        params.append(f"content={category}")
    if file_type and file_type != "":
        params.append(f"ext={file_type.lower()}")
    if sort and sort != "":
        params.append(f"sort={sort}")

    url = f"{BASE_URL}/search?index=&q={q}"
    if params:
        url += "&" + "&".join(params)
    return url

def _extract_md5_from_page_url(page_url: str) -> str:
    match = re.search(r'/md5/([a-fA-F0-9]{32})', page_url)
    if match:
        return match.group(1)
    return page_url.rstrip('/').split('/')[-1]

def _parse_search_results(html: str, file_type: Optional[str]=None) -> List[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for a in soup.find_all("a", href=True):
        h3 = a.find("h3")
        if not h3:
            continue
        title = h3.get_text(strip=True)
        link = a['href']
        if not link.startswith("http"):
            link = BASE_URL + link
        img = a.find("img")
        thumbnail = img['src'] if img and img.has_attr("src") else None
        info = ""
        info_div = a.find("div", class_="line-clamp-[2] leading-[1.2] text-[10px] lg:text-xs text-gray-500")
        if info_div:
            info = info_div.get_text(strip=True)
        if file_type and file_type.lower() not in (info or "").lower():
            continue
        author = None
        author_div = a.find("div", class_="max-lg:line-clamp-[2] lg:truncate leading-[1.2] lg:leading-[1.35] max-lg:text-sm italic")
        if author_div:
            author = author_div.get_text(strip=True)
        publisher = None
        pub_div = a.find("div", class_="truncate leading-[1.2] lg:leading-[1.35] max-lg:text-xs")
        if pub_div:
            publisher = pub_div.get_text(strip=True)
        result = {
            "title": title,
            "author": author,
            "thumbnail": thumbnail,
            "page_url": link,
            "info": info,
            "publisher": publisher,
            "MD5": _extract_md5_from_page_url(link),
        }
        results.append(result)
    return results

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.output_reading_instructions = (
        "When using this tool, make sure to show to the user the clickable page url link for each book found (copy paste it from 'page_url'). Also include the thumbnail if available."
    )

    valid_categories = {
        "", "book_any", "book_unknown", "book_fiction", "book_nonfiction",
        "book_comic", "magazine", "standards_document", "journal_article"
    }
    valid_sorts = {"newest", "oldest", "largest", "smallest", "", None}
    valid_file_types = {"pdf", "epub", "cbr", "cbz", None}

    errors = []

    # Validate category if provided
    if inputs.category is not None and inputs.category != "":
        if inputs.category not in valid_categories:
            errors.append(f"Invalid category value: '{inputs.category}'. Must be one of {sorted(valid_categories)}.")

    # Validate sort if provided
    if inputs.sort is not None and inputs.sort != "":
        if inputs.sort not in valid_sorts:
            errors.append(f"Invalid sort value: '{inputs.sort}'. Must be one of {sorted([s for s in valid_sorts if s])}.")

    # Validate file_type if provided
    if inputs.file_type is not None and inputs.file_type != "":
        if inputs.file_type.lower() not in valid_file_types:
            errors.append(f"Invalid file_type value: '{inputs.file_type}'. Must be one of {sorted([ft for ft in valid_file_types if ft])}.")

    if errors:
        output.error = "Validation errors:\n" + "\n".join(errors)
        return output

    if inputs.search_query:
        try:
            url = _book_search_url(
                query=inputs.search_query,
                file_type=inputs.file_type,
                sort=inputs.sort,
                category=inputs.category,
            )
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
            resp.raise_for_status()
            books = _parse_search_results(resp.text, file_type=inputs.file_type)
            output.results = books
            return output
        except Exception as e:
            output.error = f"Failed to search: {e}"
            return output

    output.error = "Please provide a search_query for searching books."
    return output