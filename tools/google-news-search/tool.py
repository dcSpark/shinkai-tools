# /// script
# dependencies = [
#   "requests>=2.28.0"
# ]
# ///

import requests
import os
import json
from typing import List, Dict, Optional
import time

class CONFIG:
    """
    Config holds optional parameters for SerpAPI or environment usage.
    """
    SERP_API_KEY: str  # SerpAPI key for authentication

class INPUTS:
    """
    The user inputs for this tool.
    """
    query: str                   # The user's search query
    gl: Optional[str] = "us"     # Geolocation (country code)
    hl: Optional[str] = "en"     # Language code
    num_results: Optional[int] = 10  # Max news results to return

class OUTPUT:
    """
    The JSON output from the tool. 
    We'll unify each search result, returning them in a structured list.
    """
    results: List[Dict[str, str]]
    query: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    # Validate config
    if not c.SERP_API_KEY:
        raise ValueError("SERP_API_KEY not provided in config.")

    # Validate input
    if not p.query or not p.query.strip():
        raise ValueError("No search query provided.")

    # Build request to SerpAPI "google_news" engine
    url = "https://serpapi.com/search"
    params = {
        "engine": "google_news",
        "q": p.query.strip(),
        "api_key": c.SERP_API_KEY,
        "hl": p.hl or "en",   # language
        "gl": p.gl or "us",   # geolocation/country code
        "num": p.num_results if p.num_results else 10,
    }

    start_time = time.time()
    resp = requests.get(url, params=params)
    elapsed = time.time() - start_time

    if resp.status_code != 200:
        raise RuntimeError(
            f"Google News search failed with HTTP {resp.status_code}: {resp.text}"
        )

    data = resp.json()

    # In SerpAPI's response, we expect a top-level "news_results" key
    raw_results = data.get("news_results", [])
    # Convert them to a simpler structure
    articles = []
    for item in raw_results[: p.num_results]:
        # Items typically contain:
        #   "title", "link", "source" => { "name": str }, "snippet", "date", ...
        # We'll unify them into a consistent structure
        article = {
            "title": item.get("title", "Untitled"),
            "link": item.get("link", ""),
            "source": item.get("source", {}).get("name", "Unknown"),
            "snippet": item.get("snippet", ""),
            "date": item.get("date", ""),
        }
        articles.append(article)

    # Prepare our result object
    output = OUTPUT()
    output.results = articles
    output.query = p.query.strip()

    # (optional) some debug prints or logging
    print(f"[google-news-search] Found {len(articles)} articles in {elapsed:.2f} seconds.")
    return output 