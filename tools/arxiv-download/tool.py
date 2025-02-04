# /// script
# dependencies = [
#   "requests",
#   "arxiv>=1.4.7",
#   "pymupdf4llm",
#   "pathlib"
# ]
# ///

import arxiv
import requests
import json
import pymupdf4llm
from pathlib import Path
from typing import Dict, Any

class CONFIG:
    storage_folder: str = "arxiv_papers"

class INPUTS:
    paper_id: str  # e.g. "2101.00001"
    convert_to_md: bool = True

class OUTPUT:
    status: str
    message: str
    md_file: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    """
    Download a paper from arXiv by ID, store as PDF in the storage folder, optionally convert to .md
    """
    folder = Path(c.storage_folder)
    folder.mkdir(parents=True, exist_ok=True)

    # if we already have .md for that paper, skip
    md_path = folder / f"{p.paper_id}.md"
    if md_path.exists():
        out = OUTPUT()
        out.status = "exists"
        out.message = f"Paper {p.paper_id} already downloaded/converted."
        out.md_file = str(md_path)
        return out

    # otherwise, we do the download
    search = arxiv.Search(id_list=[p.paper_id])
    client = arxiv.Client()
    try:
        paper = next(client.results(search))
    except StopIteration:
        out = OUTPUT()
        out.status = "error"
        out.message = f"Paper not found: {p.paper_id}"
        out.md_file = ""
        return out

    # Download PDF
    pdf_path = folder / f"{p.paper_id}.pdf"
    if not pdf_path.exists():
        paper.download_pdf(dirpath=str(folder), filename=pdf_path.name)

    # Optionally convert
    if p.convert_to_md:
        # Convert using pymupdf4llm
        try:
            markdown_text = pymupdf4llm.to_markdown(str(pdf_path), show_progress=False)
            md_path.write_text(markdown_text, encoding='utf-8')
            # remove pdf if you want
            # pdf_path.unlink()
        except Exception as e:
            out = OUTPUT()
            out.status = "error"
            out.message = f"Conversion failed: {str(e)}"
            out.md_file = ""
            return out

    out = OUTPUT()
    out.status = "success"
    out.message = f"Paper {p.paper_id} downloaded successfully."
    out.md_file = str(md_path) if p.convert_to_md else ""
    return out 