# /// script
# dependencies = [
#   "requests",
#   "arxiv>=1.4.7",
#   "python-dateutil"
# ]
# ///

import arxiv
import json
from typing import List, Dict, Any
from dateutil import parser

class CONFIG:
    # For this tool, we don't strictly need configuration fields,
    # but we can keep them if you plan to store e.g. environment variables.
    pass

class INPUTS:
    query: str  # The search query string
    max_results: int = 10
    date_from: str = ""
    date_to: str = ""
    categories: List[str] = []  # A list of category strings

class OUTPUT:
    papers: List[Dict[str, Any]]
    total_results: int

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    """
    Search for papers on arXiv with advanced filtering.
    """
    # For safety, clamp max_results
    max_results = max(1, min(p.max_results, 50))

    # If categories were provided, combine them into a single query
    search_query = p.query.strip()
    if p.categories:
        cat_filter = " OR ".join(f"cat:{cat.strip()}" for cat in p.categories)
        search_query = f"({search_query}) AND ({cat_filter})"

    search = arxiv.Search(
        query=search_query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate
    )

    # Date filters
    date_from = None
    date_to = None

    # Attempt to parse date range if provided
    if p.date_from:
        try:
            date_from = parser.parse(p.date_from)
        except Exception as e:
            # not fatal, just ignore
            pass

    if p.date_to:
        try:
            date_to = parser.parse(p.date_to)
        except Exception as e:
            pass

    papers = []
    client = arxiv.Client()
    count = 0

    def is_within(date, start, end):
        if not date:
            return True
        if start and date < start:
            return False
        if end and date > end:
            return False
        return True

    for result in client.results(search):
        if is_within(result.published, date_from, date_to):
            short_id = result.get_short_id()
            # Convert authors and categories to lists before adding to dictionary
            authors_list = [str(a.name) for a in result.authors]
            categories_list = list(result.categories)
            
            papers.append({
                "id": short_id,
                "title": result.title,
                "authors": authors_list,  # Now explicitly a list of strings
                "abstract": result.summary,
                "published": result.published.isoformat(),
                "categories": categories_list,  # Now explicitly a list
                "pdf_url": result.pdf_url
            })
            count += 1
            if count >= max_results:
                break

    out = OUTPUT()
    out.papers = papers
    out.total_results = len(papers)
    return out 