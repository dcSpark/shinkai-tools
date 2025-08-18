# /// script
# dependencies = [
# "googlesearch-python"
# ]
# ///
from googlesearch import search, SearchResult
from typing import List
from dataclasses import dataclass
import json

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
        results = search(query, num_results=p.num_results, advanced=True)
    except Exception as e:
        raise RuntimeError(f"Search failed: {str(e)}")

    output = OUTPUT()
    output.results = results
    output.query = query
    return output