# /// script
# dependencies = [
# "ddgs"
# ]
# ///

from ddgs import DDGS
from typing import List
from dataclasses import dataclass
import json

@dataclass
class SearchResult:
    title: str
    description: str
    url: str

class CONFIG:
    pass

class INPUTS:
    query: str
    num_results: int = 10

class OUTPUT:
    results: List[SearchResult]
    query: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    query = p.query
    if not query:
        raise ValueError("No search query provided")

    results = []
    
    try:
        with DDGS() as ddgs:
            search_results = list(ddgs.text(query, max_results=p.num_results))
            
        for result in search_results:
            results.append(SearchResult(
                title=result.get('title', 'No title'),
                description=result.get('body', 'No description'),
                url=result.get('href', 'No URL')
            ))

    except Exception as e:
        raise RuntimeError(f"DDGS search failed: {str(e)}")

    if not results:
        raise RuntimeError("No search results found")

    output = OUTPUT()
    output.results = results
    output.query = query
    return output
