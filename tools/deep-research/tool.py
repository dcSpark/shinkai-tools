# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, List, Dict, Tuple, Set, Optional, Callable
import asyncio
import json
import re
import os
from datetime import date

from shinkai_local_tools import (
    shinkai_llm_prompt_processor,
    duck_duck_go_search,
    download_pages,
    pdf_text_extractor,
    wait_1_5_seconds
)
from shinkai_local_support import get_home_path


# --------------------------- Config / simple types ---------------------------
class CONFIG:
    top_results_per_query: int = 4 # number of best results to read for each search
    max_additional_queries_per_section: int = 2 # number of new queries to generate to fill section gaps during each reflection loop
    max_reflection_loops: int = 1 # number of reflection loops to perform to eventually look for more information
    include_execution_log: bool = False # set to True to include the detailed execution log in the output
    # --- Config for content truncation ---
    truncate_first_chars: int = 50000 # Max characters to take from the beginning of a source. Set to 0 to disable.
    truncate_last_chars: int = 15000 # Max characters to take from the end of a source. Set to 0 to disable.
    # --- Config for concurrent workers ---
    max_concurrent_downloads: int = 60 # max number of concurrent results webpages to download at any given time
    max_concurrent_llm_calls: int = 15 # max number of concurrent LLM calls to perform at any given a time


class INPUTS:
    research_query: str


class OUTPUT:
    final_report: str
    all_executed_queries: Dict[str, Dict[str, Any]]
    referenced_urls: List[str]
    execution_log: Optional[List[str]]
    md_file_path: str
    md_export_message: str


# --------------------------- Globals ---------------------------
CURRENT_DATE: Optional[str] = None


# --------------------------- Utility ---------------------------
async def async_wait_1_5s():
    await wait_1_5_seconds({})


# --------------------------- Markdown / string helpers ---------------------------
def _strip_outer_fenced_block(text: str) -> Optional[str]:
    if text is None:
        return None
    m = re.match(r"^\s*```[\w+-]*\n(.*)\n```\s*$", text, flags=re.DOTALL)
    if m:
        return m.group(1)
    m2 = re.match(r"^\s*'''\s*\n?(.*)\n?'''\s*$", text, flags=re.DOTALL)
    if m2:
        return m2.group(1)
    return None

def _clean_url(url: str) -> str:
    """Removes common trailing punctuation from a URL that LLMs might add."""
    if not isinstance(url, str):
        return ""
    return url.strip().rstrip('.,;:)')

def _clean_markdown_citations(text: str) -> str:
    """Finds all [ Source: URL ] citations in markdown and cleans the URL."""
    pattern = r'(\[\s*Source:\s*)(https?://[^\s\]]+)(\s*\])'
    
    def replacer(match):
        prefix, url, suffix = match.groups()
        cleaned_url = _clean_url(url)
        return f"{prefix}{cleaned_url}{suffix}"
        
    return re.sub(pattern, replacer, text)


def sanitize_markdown_block(text: str) -> str:
    if not text:
        return ""
    t = text
    for _ in range(3):
        inner = _strip_outer_fenced_block(t)
        if inner is None:
            break
        t = inner
    t = t.strip('\ufeff')
    return t.strip()


def remove_redundant_section_heading(text: str, section_title: str) -> str:
    if not text:
        return ""
    pattern = r"^\s*##\s*(?:\d+\.\s*)?" + re.escape(section_title) + r"\s*(?:\n+|$)"
    new_text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    return new_text.lstrip()


def slugify(text: str) -> str:
    if not text:
        return ""
    s = text.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return s


def sanitize_filename_candidate(name: str, max_len: int = 60) -> str:
    s = name.replace(" ", "_")
    s = re.sub(r"[^A-Za-z0-9_\-\.]", "", s)
    return s[:max_len]


def _clean_and_dedupe_section(section_title: str, section_desc: str, sec_num: int, md: str) -> str:
    if not md:
        return ""
    lines = md.splitlines()
    i = 0
    n = len(lines)
    while i < n and lines[i].strip() == "": i += 1
    if i < n and re.match(rf"^\s*##\s*(?:\d+\.\s*)?{re.escape(section_title)}\b", lines[i], flags=re.IGNORECASE):
        i += 1
        while i < n and lines[i].strip() == "": i += 1
        if i < n and lines[i].strip() == f"*{section_desc}*":
            i += 1
            while i < n and lines[i].strip() == "": i += 1
    remaining = "\n".join(lines[i:]).lstrip()
    blocks = re.split(r'(?=(?:^###\s))', remaining, flags=re.MULTILINE)
    seen_subtitles: Set[str] = set()
    output_blocks: List[str] = []
    for b in blocks:
        if not b.strip(): continue
        m = re.match(r"^\s*###\s*(?:\d+\.\d+\s*)?(.*)", b.strip(), flags=re.IGNORECASE)
        if m:
            raw_title_line = m.group(1).splitlines()[0].strip()
            norm = re.sub(r"\s+", " ", raw_title_line).strip().lower()
            if norm in seen_subtitles: continue
            seen_subtitles.add(norm)
            output_blocks.append(b.rstrip())
        else:
            output_blocks.append(b.rstrip())
    cleaned = "\n\n".join(output_blocks).strip()
    return cleaned


def _get_ordinal_date() -> str:
    """Returns the current date in '25th August 2025' format."""
    today = date.today()
    day = today.day
    if 4 <= day <= 20 or 24 <= day <= 30:
        suffix = "th"
    else:
        suffix = ["st", "nd", "rd"][day % 10 - 1]
    return today.strftime(f"{day}{suffix} %B %Y")


def _truncate_content_bookend(content: str, first_chars: int, last_chars: int) -> str:
    """
    Truncates content by taking the first `first_chars` and the last `last_chars`.
    If the content is shorter than the sum of both, or if one is 0, it behaves gracefully.
    """
    if not content:
        return ""
    
    # If both are disabled, return the full content
    if first_chars <= 0 and last_chars <= 0:
        return content

    content_len = len(content)
    
    # If content is short enough to not need truncation, return it as is.
    if content_len <= first_chars + last_chars:
        return content

    # Handle cases where only one of the two is enabled
    if first_chars > 0 and last_chars <= 0:
        return content[:first_chars]
    
    if last_chars > 0 and first_chars <= 0:
        return content[-last_chars:]

    # The main case: get both ends
    first_part = content[:first_chars]
    last_part = content[-last_chars:]
    
    separator = "\n\n[... content truncated ...]\n\n"
    
    return f"{first_part.rstrip()}{separator}{last_part.lstrip()}"


# --------------------------- Low-level raw helpers (no internal delays) ---------------------------
async def llm_raw_call(payload: Dict[str, Any], log_fn) -> Dict[str, Any]:
    try:
        resp = await shinkai_llm_prompt_processor(payload)
        log_fn("INFO: llm_raw_call completed.")
        return resp or {}
    except Exception as e:
        log_fn(f"ERROR: llm_raw_call failed: {e}")
        return {}


async def search_raw(query: str, log_fn) -> List[Dict[str, Any]]:
    try:
        res = await duck_duck_go_search({"message": query})
        msg = res.get("message")
        if not msg:
            log_fn(f"WARN: search_raw for '{query}' returned an empty message.")
            return []
        parsed = json.loads(msg)
        if isinstance(parsed, list):
            log_fn(f"INFO: search_raw for '{query}' returned {len(parsed)} results.")
            return parsed
        else:
            log_fn(f"WARN: search_raw unexpected format for '{query}'.")
            return []
    except json.JSONDecodeError as e:
        log_fn(f"ERROR: search_raw failed to parse JSON for '{query}': {e}. Response was: '{msg}'")
        return []
    except Exception as e:
        log_fn(f"ERROR: search_raw failed for '{query}': {e}")
        return []


async def extract_content_from_url(url: str, log_fn) -> Tuple[str, str]:
    try:
        page_resp = await download_pages({"url": url})
        content = page_resp.get("markdown", "")
        if content and len(content) > 100:
            log_fn(f"INFO: [download_pages] Extracted {len(content)} chars from page {url}")
            return content, "page"
    except Exception as e:
        log_fn(f"INFO: download_pages failed for {url}: {e}")

    try:
        pdf_resp = await pdf_text_extractor({"url": url})
        content = pdf_resp.get("text_content", "")
        if content and len(content) > 100:
            log_fn(f"INFO: [pdf_downloader] Extracted {len(content)} chars from PDF {url}")
            return content, "pdf"
    except Exception as e:
        log_fn(f"INFO: pdf_downloader failed for {url}: {e}")

    log_fn(f"WARN: No extractable content at {url} after all attempts.")
    return "", "none"

# --------------------------- High-level LLM helpers ---------------------------
def _extract_message_text(resp: Dict[str, Any]) -> str:
    if not resp:
        return ""
    return resp.get("message", "") or ""


async def llm_json_from_message(prompt: str, log_fn) -> Dict[str, Any]:
    full_prompt = (f"Current date: {CURRENT_DATE}.\n\n" if CURRENT_DATE else "") + prompt
    resp = await llm_raw_call({"prompt": full_prompt, "format": "text"}, log_fn)
    msg = _extract_message_text(resp)
    if not msg:
        log_fn("WARN: Empty LLM message for JSON parsing.")
        return {}
    m = re.search(r"\{.*\}", msg, re.DOTALL)
    if m:
        try:
            parsed = json.loads(m.group(0))
            log_fn("INFO: Parsed JSON from LLM message.")
            return parsed
        except Exception as e:
            log_fn(f"ERROR: Failed to parse JSON from LLM message: {e}")
            return {}
    log_fn("WARN: No JSON object found in LLM message.")
    return {}


async def llm_text_from_message(prompt: str, log_fn) -> str:
    full_prompt = (f"Current date: {CURRENT_DATE}.\n\n" if CURRENT_DATE else "") + prompt
    resp = await llm_raw_call({"prompt": full_prompt, "format": "text"}, log_fn)
    msg = _extract_message_text(resp)
    if msg:
        log_fn("INFO: llm_text_from_message returned content.")
        return msg
    log_fn("WARN: llm_text_from_message returned empty message.")
    return ""


# --------------------------- Prompt builders ---------------------------
def _research_plan_prompt(query: str) -> str:
    return (
        "You are a senior research strategist and web research planner.\n\n"
        "Task: For the research topic below, think deeply about the different parts, aspects and underlying subtleties of the topic, and produce a complete structured research plan really tailored to the query, in ONE JSON object.\n\n"
        f"Topic: \"{query}\"\n\n"
        "Required JSON structure (example):\n"
        "{\n"
        '  \"Historical Background\": {\n'
        '     \"description\": \"Explain origins and evolution in one sentence.\",\n'
        '     \"subsections\": [\n'
        '        {\"title\": \"Origins\", \"description\": \"When and how it began.\", \"query\": \"origins of ...\"},\n'
        '        {\"title\": \"Evolution\", \"description\": \"Major changes over time.\", \"query\": \"timeline of ...\"}\n'
        "     ]\n"
        "  },\n"
        '  "Applications": { "description": "Survey practical uses.", "subsections": [...] }\n'
        "}\n\n"
        "Rules and constraints (important):\n"
        "- Produce 4 to 5 complementary, non-overlapping top-level sections that together cover the topic.\n"
        "- For each section, provide a single concise one-sentence 'description' that states the goal of that section.\n"
        "- For each section, provide 2 to 3 subsections. Each subsection must have:\n"
        "  - 'title' (short, unique across the whole plan),\n"
        "  - 'description' (one sentence),\n"
        "  - 'query' (one highly targeted web search query optimized to find authoritative sources, the type of best sources to target should be adapted to the subsection and query).\n"
        "- Ensure subsection titles and descriptions do not overlap with other subsections or sections (be precise and mutually exclusive).\n"
        "- Use concise, descriptive titles (no punctuation that would break JSON keys).\n"
        "- Keep everything strictly valid JSON — the assistant caller will parse it programmatically.\n"
        "- Avoid generating generic subsections; tailor each subsection to the specific research topic.\n\n"
        "Output MUST be only the JSON object (no surrounding explanation)."
    )

def _ranking_prompt_for_query(query_text: str, search_results: List[Dict[str, Any]]) -> str:
    results_for_prompt = []
    for r in search_results:
        results_for_prompt.append({
            "url": r.get("url"),
            "title": (r.get("title") or "")[:250],
            "description": (r.get("description") or "")[:1000]
        })
    candidates_json = json.dumps(results_for_prompt, indent=2)
    return (
        "You are a research assistant tasked with ranking web search results for relevance and quality.\n\n"
        f"Main query: {query_text}\n\n"
        "Search candidate set (JSON array of objects with keys url, title, description):\n\n"
        + candidates_json
        + "\n\n"
        "Instructions:\n"
        "- For each candidate, give an integer score 0-5 (5 = highly relevant/credible/useful, 0 = irrelevant).\n"
        "- Consider relevance to the query, source credibility, recency, and content quality.\n"
        "- Return a JSON object with a single key 'ranked_results' whose value is a list of objects with keys: url, title, score (int).\n"
        "Example output:\n"
        '{"ranked_results": [{"url": "https://...", "title": "...", "score": 5}, {"url": "...", "title": "...", "score": 3}]}'
    )

def _subsection_synthesis_prompt(research_query: str, section_title: str, subsection_title: str,
                                 subsection_desc: str, existing_section_context: str,
                                 top_sources: List[Dict[str, str]],
                                 truncate_config: Tuple[int, int]) -> str:
    first_chars, last_chars = truncate_config
    sources_summary = "\n\n---\n\n".join(
        [f"Source URL: {s['url']}\nContent excerpt:\n{_truncate_content_bookend(s['content'], first_chars, last_chars)}" for s in top_sources])
    return (
        "You are a professional research analyst. Produce a well-structured markdown subsection that answers the query below.\n\n"
        f"Main Research Query: {research_query}\n"
        f"Section: {section_title}\n"
        f"Subsection: {subsection_title} — {subsection_desc}\n\n"
        f"Existing Section Context (to avoid duplication):\n{existing_section_context or 'None provided'}\n\n"
        "Instructions:\n"
        "- Synthesize the key findings from the NEW SOURCE MATERIALS into a cohesive narrative in your own words.\n"
        "- Be specific and precise; avoid generalities.\n"
        "- When appropriate, use markdown formatting such as bullet points, numbered lists, or tables to present information clearly and concisely. Do not overuse them.\n"
        "- Include inline citations for every important claim using [ Source: URL ]. Make sure actual clickable URLs are well separated from the other characters. Example : '[ Source: https://www.shinkai.com/ ] [ Source: https://docs.shinkai.com/introduction ]' \n"
        "- Do **not** include a heading for the subsection – the caller will add a numbered heading.\n\n"
        "NEW SOURCE MATERIALS (excerpts):\n\n"
        f"{sources_summary}\n\n"
        f"Output: A polished markdown paragraph block (no heading)."
    )

def _supplemental_prompt_for_query(research_query: str, section_title: str, section_desc: str,
                                   current_section_markdown: str, query: str,
                                   top_sources: List[Dict[str, str]],
                                   truncate_config: Tuple[int, int]) -> str:
    first_chars, last_chars = truncate_config
    sources_summary = "\n\n".join(
        [f"Source URL: {s['url']}\nContent excerpt:\n{_truncate_content_bookend(s['content'], first_chars, last_chars)}" for s in top_sources])
    return (
        f"You are enhancing the section '{section_title}' for the research topic '{research_query}'.\n"
        f"Section goal: {section_desc}\n\n"
        "Current Section Content:\n"
        f"{current_section_markdown}\n\n"
        f"New Query to Address a Gap: {query}\n\n"
        "Instructions:\n"
        "- Synthesize NEW content that complements what already exists; avoid repeating existing content.\n"
        "- Be exhaustive regarding this query but concise; integrate critical facts with context.\n"
        "- Write with a high quality of thought (being detailed but with concision, forthrighness, choosing exactly the right words to increase quality without sacrificing detail.\n"
        "- When appropriate, use markdown formatting such as bullet points, numbered lists, or tables to present information clearly. Do not overuse them.\n"
        "- Include inline citations for every important claim using [ Source: URL ]. Make sure actual clickable URLs are well separated from the other characters. Example : '[ Source: https://www.shinkai.com/ ] [ Source: https://docs.shinkai.com/introduction ]' \n"
        "- Use markdown formatting (headings, lists) and write as an addendum block for this section.\n\n"
        "NEW SOURCE MATERIALS (excerpts):\n\n"
        f"{sources_summary}\n\n"
        f"Output: A concise markdown block titled '#### Supplemental: {query}'."
    )

def _rewrite_section_prompt(research_query: str, section_title: str, section_desc: str,
                           old_section_markdown: str, supplemental_blocks: List[str]) -> str:
    supplements = "\n\n---\n\n".join(supplemental_blocks) if supplemental_blocks else "None"
    return (
        "You are rewriting a section of a research report. Maintain all existing information and citations while integrating the supplemental content. "
        "Only add relevant new information; do not remove details or sources.\n\n"
        f"Main Research Query: {research_query}\n"
        f"Section: {section_title}\n"
        f"Section Goal: {section_desc}\n\n"
        "Current Section Content (to preserve):\n"
        f"{old_section_markdown}\n\n"
        "Supplemental Content to Integrate:\n"
        f"{supplements}\n\n"
        "Instructions:\n"
        "- Be exhaustive without redundancy.\n"
        "- Be specific and precise; avoid generalities.\n"
        "- Write with a high quality of thought (being detailed but with concision, forthrighness, choosing exactly the right words to increase quality without sacrificing detail.\n"
        "- Keep and merge all citations [ Source: URL ]. Make sure actual clickable URLs are well separated from the other characters. Example : '[ Source: https://www.shinkai.com/ ] [ Source: https://docs.shinkai.com/introduction ]'\n"
        "- Include inline citations for every important claim using [ Source: URL ].  \n"
        "- Ensure a coherent flow and structure with markdown headings.\n"
        "- Output **only** the final, polished markdown for the full section (including the numbered heading)."
    )

def _abstract_prompt(report_body: str, research_query: str) -> str:
    return (
        "Write a concise, comprehensive abstract for the research report below. "
        "Highlight purpose, method (brief), key findings, and significance. Use 150-300 words.\n\n"
        f"Main Research Question: {research_query}\n\n"
        "Full Report Body (sections only):\n"
        f"{report_body}\n"
        "Instructions:\n"
        "- Do **not** include any heading. Output only the abstract text.\n"
        "- Be specific and precise; avoid generalities.\n"
        "- Write with a high quality of thought (being detailed but with concision, forthrighness, choosing exactly the right words to increase quality without sacrificing detail.\n"
    )

def _conclusion_prompt(report_body: str, research_query: str) -> str:
    return (
        "Write a strong conclusion for the research report below. Summarize key insights, discuss limitations, and suggest future directions. "
        "Use 200-400 words.\n\n"
        f"Main Research Question: {research_query}\n\n"
        "Full Report Body (sections only):\n"
        f"{report_body}\n"
        "Instructions:\n"
        "- Do **not** include any heading. Output only the conclusion text.\n"
        "- Be specific and precise; avoid generalities.\n"
        "- Write with a high quality of thought (being detailed but with concision, forthrighness, choosing exactly the right words to increase quality without sacrificing detail.\n"
    )

def _filename_prompt(research_query: str) -> str:
    return (
        "Create a short, explicit filename candidate for this research query.\n"
        "Rules:\n"
        "- Use only letters, numbers, underscores and hyphens.\n"
        "- Replace spaces with underscores.\n"
        "- Keep it short (≤ 40 characters) but descriptive.\n"
        "- Do NOT include a file extension.\n\n"
        f"Research query: {research_query}\n\n"
        "Return JUST the filename (no extra text)."
    )

def _title_prompt(abstract: str, research_query: str) -> str:
    return (
        "You are an expert copywriter. Based on the research query and the following abstract, create a concise and compelling title for the report.\n\n"
        f"Original Research Query: {research_query}\n\n"
        "Report Abstract:\n"
        f"{abstract}\n\n"
        "Instructions:\n"
        "- The title should be engaging and accurately reflect the content summarized in the abstract.\n"
        "- Do not just repeat the original query.\n"
        "- Keep it to a single line.\n"
        "- Return ONLY the title text, with no quotation marks or extra labels."
    )


# --------------------------- Dispatchers (Unchanged) ---------------------------
async def dispatch_staggered_searches(queries: List[str], log_fn: Callable[[str], None]) -> List[Any]:
    tasks = []
    for q in queries:
        await async_wait_1_5s()
        tasks.append(asyncio.create_task(search_raw(q, log_fn)))
    return await asyncio.gather(*tasks, return_exceptions=True)

async def dispatch_staggered_llm_json(prompts: List[str], log_fn: Callable[[str], None]) -> List[Any]:
    tasks = []
    for p in prompts:
        await async_wait_1_5s()
        tasks.append(asyncio.create_task(llm_json_from_message(p, log_fn)))
    return await asyncio.gather(*tasks, return_exceptions=True)

async def dispatch_staggered_llm_text(prompts: List[str], log_fn: Callable[[str], None]) -> List[Any]:
    tasks = []
    for p in prompts:
        await async_wait_1_5s()
        tasks.append(asyncio.create_task(llm_text_from_message(p, log_fn)))
    return await asyncio.gather(*tasks, return_exceptions=True)

# --------------------------- Concurrent Worker Functions ---------------------------
async def synthesis_worker(
    worker_id: int,
    queue: asyncio.Queue,
    results_dict: Dict[Tuple[str, int], str],
    log_fn
):
    """Pulls synthesis jobs from a queue, executes them, and stores the result."""
    while True:
        try:
            subsection_key, prompt = await queue.get()
            log_fn(f"INFO: SynthWorker-{worker_id} starting: {subsection_key}")
            await async_wait_1_5s()
            result = await llm_text_from_message(prompt, log_fn)
            results_dict[subsection_key] = result if isinstance(result, str) else ""
            queue.task_done()
            log_fn(f"INFO: SynthWorker-{worker_id} finished: {subsection_key}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            log_fn(f"ERROR: SynthWorker-{worker_id} failed: {e}")
            if 'subsection_key' in locals(): results_dict[subsection_key] = ""
            queue.task_done()

async def downloader_and_orchestrator_worker(
    worker_id: int,
    url_queue: asyncio.Queue,
    synthesis_queue: asyncio.Queue,
    processed_urls_cache: Dict[str, str],
    url_to_subsections_map: Dict[str, List[Tuple[str, int]]],
    subsection_dependencies: Dict[Tuple[str, int], Set[str]],
    sections_data: Dict[str, Any],
    research_query: str,
    ranked_urls_by_query: Dict[str, List[str]],
    truncate_config: Tuple[int, int],
    log_fn
):
    """Pulls a URL to download, and after downloading, checks if any subsections are now ready for synthesis."""
    while not url_queue.empty():
        url = None
        try:
            url = await url_queue.get()
            log_fn(f"INFO: Downloader-{worker_id} fetching: {url}")
            content, _ = await extract_content_from_url(url, log_fn)
            processed_urls_cache[url] = content or ""
            
            subsections_to_check = url_to_subsections_map.get(url, [])
            for key in subsections_to_check:
                required_urls = subsection_dependencies.get(key)
                if required_urls and all(u in processed_urls_cache for u in required_urls):
                    sec_title, sub_idx = key
                    sub = sections_data[sec_title]["subsections"][sub_idx]
                    if sub.get("synthesis_queued"): continue
                    sub["synthesis_queued"] = True
                    log_fn(f"INFO: Downloader-{worker_id} triggered synthesis for: {key}")
                    
                    ordered_urls = [u for u in ranked_urls_by_query.get(sub["query"], []) if u in required_urls]
                    ordered_urls.extend([u for u in required_urls if u not in ordered_urls])
                    top_sources = [{"url": u, "content": processed_urls_cache.get(u, "")} for u in ordered_urls if processed_urls_cache.get(u, "")]
                    
                    prompt = f"### {sub['title']}\n\nNo reliable sources were found for query: {sub['query']}" if not top_sources else _subsection_synthesis_prompt(research_query, sec_title, sub["title"], sub["description"], "", top_sources, truncate_config)
                    await synthesis_queue.put((key, prompt))
            url_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            log_fn(f"ERROR: Downloader-{worker_id} failed on {url}: {e}")
            if url: url_queue.task_done()

# --------------------------- Full pipeline ---------------------------
async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    log_messages: List[str] = []
    
    # Define a conditional logger function
    def log(message: str):
        if config.include_execution_log:
            log_messages.append(message)

    log(f"START: Full staged pipeline for query: '{inputs.research_query}'") # Use the new log function
    global CURRENT_DATE
    CURRENT_DATE = _get_ordinal_date()
    log(f"INFO: Current date set to {CURRENT_DATE}")

    # This dictionary will store all queries in a structured way for the output.
    executed_queries_by_section: Dict[str, Dict[str, Any]] = {}

    # --- Phase 1 & 1b: Research Plan ---
    log("[Phase 1] Generating research plan...")
    await async_wait_1_5s()
    rp = await llm_json_from_message(_research_plan_prompt(inputs.research_query), log)
    research_plan = rp if isinstance(rp, dict) and rp else {}
    if not research_plan:
        log("WARN: Empty research plan – falling back to single-section.")
        research_plan = {inputs.research_query: {"description": "Answer the user's primary question.", "subsections": [{"title": "Overview", "description": "General overview", "query": inputs.research_query}]}}
    ordered_section_titles = list(research_plan.keys())
    sections_data: Dict[str, Dict[str, Any]] = {}
    all_subquestions: List[str] = []
    seen_titles_global: Set[str] = set()
    for sec_title in ordered_section_titles:
        # Initialize the structure for this section in the output dictionary
        executed_queries_by_section[sec_title] = {
            "initial_queries": [],
            "supplemental_queries": []
        }
        
        val = research_plan.get(sec_title, {})
        desc = val.get("description", "").strip()
        subsecs = []
        raw_subs = val.get("subsections") if isinstance(val.get("subsections"), list) else [{"title": "Overview", "description": desc, "query": inputs.research_query}]
        for s in raw_subs:
            if not isinstance(s, dict): continue
            title, sdesc, q = (s.get("title") or "").strip(), (s.get("description") or "").strip(), (s.get("query") or "").strip()
            if not (title and sdesc and q): continue
            norm_title = title.strip().lower()
            if norm_title in seen_titles_global:
                original, idx = title, 2
                while f"{original} ({idx})".strip().lower() in seen_titles_global: idx += 1
                title = f"{original} ({idx})"
            seen_titles_global.add(title.strip().lower())
            subsecs.append({"title": title, "description": sdesc, "query": q, "final_markdown": ""})
            
            # Keep populating the flat list for internal deduplication logic...
            all_subquestions.append(q)
            # ...and also populate the new structured dictionary for the final output.
            executed_queries_by_section[sec_title]["initial_queries"].append({
                "subsection_title": title,
                "query": q
            })
            
        sections_data[sec_title] = {"description": desc, "subsections": subsecs, "final_markdown": ""}

    # --- Phase 3 & 3.5: Search and Rank ---
    log("[Phase 3 & 3.5] Searching all queries and ranking results...")
    uniq_queries: List[str] = list(dict.fromkeys(all_subquestions))
    raw_search_results = await dispatch_staggered_searches(uniq_queries, log)
    ranking_prompts = [_ranking_prompt_for_query(qt, raw) if isinstance(raw, list) and raw else "" for qt, raw in zip(uniq_queries, raw_search_results)]
    ranking_results = await dispatch_staggered_llm_json([p for p in ranking_prompts if p], log)
    top_n = getattr(config, "top_results_per_query", CONFIG.top_results_per_query)
    ranked_urls_by_query: Dict[str, List[str]] = {}
    rank_res_iter = iter(ranking_results)
    for idx, query_text in enumerate(uniq_queries):
        urls = []
        raw = raw_search_results[idx] if isinstance(raw_search_results[idx], list) else []
        if ranking_prompts[idx]:
            rank_res = next(rank_res_iter, {})
            if isinstance(rank_res, dict):
                ranked = sorted(rank_res.get("ranked_results", []), key=lambda x: int(x.get("score", 0)), reverse=True)
                urls = [_clean_url(r.get("url")) for r in ranked if r.get("url")]
        urls.extend([_clean_url(r.get("url")) for r in raw if r.get("url") and _clean_url(r.get("url")) not in urls])
        ranked_urls_by_query[query_text] = urls[:top_n]

    # --- Phase 4: Consolidate URLs ---
    log("[Phase 4] Deduplicating URLs...")
    url_map: Dict[str, Dict[str, Any]] = {}
    for query_text, ordered_urls in ranked_urls_by_query.items():
        for url in ordered_urls:
            if url: url_map.setdefault(url, {"url": url, "queries": set()})["queries"].add(query_text)
    log(f"INFO: Collected {len(url_map)} unique URLs.")

    # --- Phase 5 & 6: Concurrent Download and Synthesis ---
    log("[Phase 5 & 6] Starting concurrent download and synthesis engine...")
    processed_urls_cache: Dict[str, str] = {}
    subsection_markdown_results: Dict[Tuple[str, int], str] = {}
    synthesis_queue = asyncio.Queue()
    url_download_queue = asyncio.Queue()
    for url in url_map.keys(): await url_download_queue.put(url)
    subsection_dependencies: Dict[Tuple[str, int], Set[str]] = {}
    url_to_subsections_map: Dict[str, List[Tuple[str, int]]] = {}
    for sec_title, sdata in sections_data.items():
        for idx, sub in enumerate(sdata["subsections"]):
            key = (sec_title, idx)
            required_urls = set(ranked_urls_by_query.get(sub["query"], [])[:top_n])
            subsection_dependencies[key] = {u for u in required_urls if u}
            for url in required_urls:
                if url: url_to_subsections_map.setdefault(url, []).append(key)

    synthesis_workers = [asyncio.create_task(synthesis_worker(i, synthesis_queue, subsection_markdown_results, log)) for i in range(getattr(config, 'max_concurrent_llm_calls', 5))]
    truncate_config_tuple = (config.truncate_first_chars, config.truncate_last_chars)
    downloader_workers = [asyncio.create_task(downloader_and_orchestrator_worker(i, url_download_queue, synthesis_queue, processed_urls_cache, url_to_subsections_map, subsection_dependencies, sections_data, inputs.research_query, ranked_urls_by_query, truncate_config_tuple, log)) for i in range(getattr(config, 'max_concurrent_downloads', 10))]
    
    await url_download_queue.join()
    log("INFO: All URLs processed by downloaders.")
    await synthesis_queue.join()
    log("INFO: All synthesis jobs completed.")
    for worker in synthesis_workers + downloader_workers: worker.cancel()
    await asyncio.gather(*synthesis_workers, *downloader_workers, return_exceptions=True)
    log("INFO: Concurrent engine shut down.")
    
    for (sec_title, sub_idx), llm_out in subsection_markdown_results.items():
        sub = sections_data[sec_title]["subsections"][sub_idx]
        sec_num, sub_num = ordered_section_titles.index(sec_title) + 1, sub_idx + 1
        content = _clean_markdown_citations(sanitize_markdown_block(llm_out))
        content = re.sub(r"^\s*###\s+.*\n", "", content)
        sub["final_markdown"] = f"### {sec_num}.{sub_num} {sub['title']}\n\n{content}"
    
    for sec_title, sdata in sections_data.items():
        # We no longer create a header here. 
        # sdata["final_markdown"] will now only contain the body of the section.
        sub_blocks = "\n\n".join([sub["final_markdown"] for sub in sdata["subsections"]])
        sdata["final_markdown"] = sub_blocks

    # --- Phase 7 & 8: Reflection and Append Loop ---
    max_loops = getattr(config, 'max_reflection_loops', 1)
    for i in range(max_loops):
        loop_num = i + 1
        log(f"[Reflection Loop {loop_num}/{max_loops}] Starting...")

        reflect_prompts = []
        reflect_sections = []
        for sec_title, sdata in sections_data.items():
            prompt = (
                "You are a critical-thinking expert. Reflect on the section content and propose up to "
                f"{getattr(config, 'max_additional_queries_per_section', 2)} "
                "highly specific new web search queries to close meaningful gaps. Do not repeat any queries that would have been used to generate the existing content.\n\n"
                f"Main research query: {inputs.research_query}\n\n"
                f"Section Title: {sec_title}\n"
                f"Section Goal: {sdata['description']}\n\n"
                "Existing Section Content:\n" + sdata["final_markdown"] + "\n\n"
                "Rules:\n- Propose queries for genuinely new, relevant information.\n- Avoid overlap.\n"
                "Output MUST be valid JSON: {\"new_queries\": [\"query1\", \"query2\"]}"
            )
            reflect_prompts.append(prompt)
            reflect_sections.append(sec_title)

        reflect_results = await dispatch_staggered_llm_json(reflect_prompts, log)

        section_additional_queries: Dict[str, List[str]] = {}
        global_additional_queries: List[str] = []
        for sec_title, res in zip(reflect_sections, reflect_results):
            new_qs = []
            if isinstance(res, dict):
                raw = res.get("new_queries", [])
                for q in raw:
                    qs = q.strip() if isinstance(q, str) else ""
                    if qs and qs not in all_subquestions and qs not in global_additional_queries:
                        new_qs.append(qs)
                        global_additional_queries.append(qs)
            section_additional_queries[sec_title] = new_qs
            log(f"INFO: [Reflection Loop {loop_num}] Section '{sec_title}' generated {len(new_qs)} new queries.")

        # Add the newly generated supplemental queries to our structured output dictionary
        for sec_title, new_queries in section_additional_queries.items():
            if sec_title in executed_queries_by_section:
                executed_queries_by_section[sec_title]["supplemental_queries"].extend(new_queries)

        log(f"INFO: [Reflection Loop {loop_num}] Total new supplemental queries: {len(global_additional_queries)}")

        if not global_additional_queries:
            log(f"[Reflection Loop {loop_num}] No new queries found. Ending reflection cycles.")
            break

        log(f"[Phase 8, Loop {loop_num}] Processing {len(global_additional_queries)} supplemental queries...")
        add_search = await dispatch_staggered_searches(global_additional_queries, log)

        add_ranking_prompts = [_ranking_prompt_for_query(q, raw) if isinstance(raw, list) and raw else "" for q, raw in zip(global_additional_queries, add_search)]
        add_ranking = await dispatch_staggered_llm_json([p for p in add_ranking_prompts if p], log)
        
        add_ranked_urls: Dict[str, List[str]] = {}
        add_rank_iter = iter(add_ranking)
        for idx, q in enumerate(global_additional_queries):
            urls = []
            raw = add_search[idx] if isinstance(add_search[idx], list) else []
            if add_ranking_prompts[idx]:
                rank_res = next(add_rank_iter, {})
                if isinstance(rank_res, dict):
                    ranked = sorted(rank_res.get("ranked_results", []), key=lambda x: int(x.get("score", 0)), reverse=True)
                    urls = [_clean_url(r.get("url")) for r in ranked if r.get("url")]
            urls.extend([_clean_url(r.get("url")) for r in raw if r.get("url") and _clean_url(r.get("url")) not in urls])
            add_ranked_urls[q] = urls[:top_n]

        new_urls = [u for u in set().union(*add_ranked_urls.values()) if u and u not in processed_urls_cache]
        if new_urls:
            log(f"INFO: [Loop {loop_num}] Downloading {len(new_urls)} new URLs for supplemental content...")
            dl_tasks = [asyncio.create_task(extract_content_from_url(u, log)) for u in new_urls]
            for f in asyncio.as_completed(dl_tasks):
                content, _ = await f
                # The URL isn't directly available from the future result, this logic is flawed in original code.
                # Assuming processed_urls_cache is updated inside extract_content_from_url, which it is not.
                # Re-writing this loop to be correct.
            new_urls_contents = await asyncio.gather(*dl_tasks)
            for url, (content, _) in zip(new_urls, new_urls_contents):
                processed_urls_cache[url] = content
        
        supplemental_prompts, supplemental_keys = [], []
        for sec_title, queries in section_additional_queries.items():
            for q in queries:
                urls = add_ranked_urls.get(q, [])
                top_srcs = [{"url": u, "content": processed_urls_cache.get(u, "")} for u in urls if processed_urls_cache.get(u, "")]
                supplemental_prompts.append(_supplemental_prompt_for_query(inputs.research_query, sec_title, sections_data[sec_title]["description"], sections_data[sec_title]["final_markdown"], q, top_srcs, truncate_config_tuple))
                supplemental_keys.append((sec_title, q))

        supplemental_blocks_by_section: Dict[str, List[str]] = {s: [] for s in sections_data}
        if supplemental_prompts:
            sup_results = await dispatch_staggered_llm_text(supplemental_prompts, log)
            for (sec_title, _), res in zip(supplemental_keys, sup_results):
                if isinstance(res, str) and res.strip():
                    blk = _clean_markdown_citations(sanitize_markdown_block(res))
                    blk = remove_redundant_section_heading(blk, sec_title)
                    supplemental_blocks_by_section[sec_title].append(blk)

        rewrite_prompts, rewrite_keys = [], []
        for sec_title, blocks in supplemental_blocks_by_section.items():
            if not blocks: continue
            rewrite_prompts.append(_rewrite_section_prompt(inputs.research_query, sec_title, sections_data[sec_title]["description"], sections_data[sec_title]["final_markdown"], blocks))
            rewrite_keys.append(sec_title)

        if rewrite_prompts:
            rewrite_results = await dispatch_staggered_llm_text(rewrite_prompts, log)
            for sec_title, res in zip(rewrite_keys, rewrite_results):
                if isinstance(res, str) and res.strip():
                    new_md = _clean_markdown_citations(sanitize_markdown_block(res))
                    new_md = remove_redundant_section_heading(new_md, sec_title)
                    sections_data[sec_title]["final_markdown"] = new_md
        
        all_subquestions.extend(global_additional_queries)

    # --- Final Assembly ---
    log("[Final Phase] Assembling final report...")
    for sec_idx, sec_title in enumerate(ordered_section_titles, start=1):
        sdata = sections_data[sec_title]
        cleaned_body = _clean_and_dedupe_section(sec_title, sdata["description"], sec_idx, sdata["final_markdown"])
        canonical_header = f"## {sec_idx}. {sec_title}\n\n*{sdata['description']}*\n\n"
        sections_data[sec_title]["final_markdown"] = canonical_header + (cleaned_body or "")

    toc_lines = ["## Table of Contents\n"]
    for sec_idx, sec_title in enumerate(ordered_section_titles, start=1):
        toc_lines.append(f"{sec_idx}. [{sec_title}](#{slugify(f'{sec_idx}-{sec_title}')})")
        for sub_idx, sub in enumerate(sections_data[sec_title]["subsections"], start=1):
            toc_lines.append(f"   {sec_idx}.{sub_idx}. [{sub['title']}](#{slugify(f'{sec_idx}-{sub_idx}-{sub['title']}')})")
    toc = "\n".join(toc_lines)

    body_sections = "\n\n---\n\n".join([sections_data[t]["final_markdown"] for t in ordered_section_titles])
    
    # First, get the abstract, conclusion, and filename in parallel
    initial_final_parts = await dispatch_staggered_llm_text([
        _abstract_prompt(body_sections, inputs.research_query),
        _conclusion_prompt(body_sections, inputs.research_query),
        _filename_prompt(inputs.research_query)
    ], log)
    
    # Unpack these three results
    abstract, conclusion, filename_candidate = (initial_final_parts[i] if len(initial_final_parts) > i and isinstance(initial_final_parts[i], str) else "" for i in range(3))
    
    # Now that we have the abstract, make a separate call to generate the title
    await async_wait_1_5s() # Maintain the delay between calls
    report_title = await llm_text_from_message(_title_prompt(abstract, inputs.research_query), log)
    report_title = report_title.strip() or inputs.research_query # Clean and provide a fallback
    
    filename_candidate = sanitize_filename_candidate(filename_candidate.splitlines()[0].strip() if filename_candidate else "", 40) or sanitize_filename_candidate(inputs.research_query, 40)
    markdown_filename = f"{filename_candidate}.md"
    
    references = sorted([_clean_url(url) for url in url_map.keys()])
    references_section = "## References\n\n" + ("\n".join(f"{i+1}. {u}" for i, u in enumerate(references)) or "_No external references gathered._")
    
    # Update the final report string to use the new title format
    final_report = f"# Deep Research Report: {report_title}\n\n*Generated on: {CURRENT_DATE}*\n\n{toc}\n\n---\n\n## Abstract\n\n{abstract}\n\n---\n\n{body_sections}\n\n---\n\n## Conclusion\n\n{conclusion}\n\n---\n\n{references_section}\n"

    home_path = await get_home_path()
    file_path = os.path.join(home_path, markdown_filename)
    try:
        with open(file_path, "w", encoding="utf-8") as f: f.write(final_report)
        md_export_message = f"Markdown file saved successfully at: {file_path}"
    except Exception as e:
        md_export_message = f"Failed to save markdown file: {e}"
    
    out = OUTPUT()

    final_log = log_messages if config.include_execution_log else None
    out.final_report, out.all_executed_queries, out.referenced_urls, out.execution_log, out.md_file_path, out.md_export_message = final_report, executed_queries_by_section, references, final_log, file_path if "successfully" in md_export_message else "", md_export_message
    
    log("END: Pipeline finished.")
    return out