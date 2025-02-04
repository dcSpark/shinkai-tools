# /// script
# requires-python = ">=3.10,<3.12"
# dependencies = [
#   "biopython==1.81",
#   "requests>=2.31.0"
# ]
# ///

import os
import asyncio
from typing import Optional
from Bio import Entrez

class CONFIG:
    entrez_email: Optional[str] = None

class INPUTS:
    query: str
    max_results: int = 15

class OUTPUT:
    status: str
    query: str
    message: str
    total_results: int
    showing: int
    records: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    """
    Searches PubMed for the specified query using the Entrez API, returning MEDLINE text records.

    Args:
        c: Configuration object. 
           `entrez_email` can be provided here or in environment var `ENTREZ_EMAIL`.
        p: Input parameters including 'query' and optionally 'max_results'.

    Returns:
        OUTPUT: The search result in a structured format.
    """
    # Determine the email from config or environment
    email = c.entrez_email or os.getenv("ENTREZ_EMAIL")
    if not email:
        raise ValueError("No Entrez email provided. Either set `ENTREZ_EMAIL` env var or pass it in the configuration.")

    # Configure Entrez
    Entrez.email = email

    if not p.query.strip():
        raise ValueError("Query string cannot be empty.")

    max_results = max(1, min(p.max_results, 15))

    try:
        # Search for IDs
        handle = Entrez.esearch(
            db="pubmed",
            term=p.query,
            retmax=max_results
        )
        results = Entrez.read(handle)
        handle.close()

        # If no results found
        if not results.get("IdList"):
            out = OUTPUT()
            out.status = "no_results"
            out.query = p.query
            out.message = f"No results found for '{p.query}'"
            out.total_results = 0
            out.showing = 0
            out.records = ""
            return out

        id_list = results["IdList"]
        id_string = ",".join(id_list)
        total = int(results.get("Count", "0"))

        # Fetch MEDLINE records
        fetch_handle = Entrez.efetch(
            db="pubmed",
            id=id_string,
            rettype="medline",
            retmode="text"
        )
        medline_data = fetch_handle.read()
        fetch_handle.close()

        out = OUTPUT()
        out.status = "success"
        out.query = p.query
        out.message = "OK"
        out.total_results = total
        out.showing = len(id_list)
        out.records = medline_data
        return out

    except Exception as e:
        out = OUTPUT()
        out.status = "error"
        out.query = p.query
        out.message = str(e)
        out.total_results = 0
        out.showing = 0
        out.records = ""
        return out 