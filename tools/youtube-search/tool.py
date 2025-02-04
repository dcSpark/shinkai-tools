# /// script
# dependencies = [
#   "requests>=2.28.0"
# ]
# ///

import requests
import json
from typing import List, Dict, Optional

class CONFIG:
    SERP_API_KEY: str

class INPUTS:
    search_query: str
    gl: Optional[str] = "us"
    hl: Optional[str] = "en"
    max_results: Optional[int] = 10

class OUTPUT:
    results: List[Dict[str, str]]
    query: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    if not c.SERP_API_KEY:
        raise ValueError("SERP_API_KEY not provided in config.")
    if not p.search_query or not p.search_query.strip():
        raise ValueError("No search query provided.")

    url = "https://serpapi.com/search"
    params = {
        "engine": "youtube",
        "search_query": p.search_query.strip(),
        "api_key": c.SERP_API_KEY,
        "hl": p.hl,
        "gl": p.gl,
    }

    resp = requests.get(url, params=params)
    if resp.status_code != 200:
        raise RuntimeError(f"YouTube search failed with HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    video_results = data.get("video_results", [])
    
    videos = []
    for item in video_results[:p.max_results]:
        video = {
            "title": item.get("title", "Untitled"),
            "link": item.get("link", ""),
            "thumbnail": item.get("thumbnail", {}).get("static", ""),
            "channel": item.get("channel", {}).get("name", "Unknown"),
            "views": item.get("views", "0"),
            "duration": item.get("duration", "")
        }
        videos.append(video)

    output = OUTPUT()
    output.results = videos
    output.query = p.search_query.strip()
    return output
