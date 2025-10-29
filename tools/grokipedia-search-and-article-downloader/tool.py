# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
import json
from urllib.parse import quote
from shinkai_local_tools import shinkai_llm_prompt_processor, download_pages

class CONFIG:
    max_fitting_articles: int = 3 # max is 10
    top_results_if_none: int = 10 # max is 10
    LLM_to_rank_search_results: Optional[str] = None

class INPUTS:
    query: str
    override_max_articles: Optional[int] = None

class OUTPUT:
    fitting_results: List[Dict[str, str]]
    fallback_links: List[str]
    status: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    query = inputs.query
    max_art = inputs.override_max_articles or config.max_fitting_articles
    max_art = min(max_art, 10)
    top_n = config.top_results_if_none
    top_n = min(top_n, 10)
    provider = config.LLM_to_rank_search_results

    search_query = quote(query)
    search_url = f"https://grokipedia.com/search?q={search_query}"
    search_result = await download_pages({"url": search_url})
    search_md = search_result["markdown"]

    fitting_prompt = f"""Based on the query '{query}', analyze the following Grokipedia search results markdown and select up to {max_art} article titles that are highly relevant and specifically match the entire query. Focus on direct, fitting matches—avoid generic, tangential, or loosely related results (e.g., do not select articles that only share one word from a specific multi-words query). If no articles are a good fit, return an empty array [].

The titles are listed after "yielded XX results:".

Output ONLY a valid JSON array of the selected titles, exactly as they appear in the markdown, e.g., ["Title1", "Title2"] or [] if none fit.

Markdown:
{search_md}"""
    llm_input = {
        "prompt": fitting_prompt,
        "format": "text"
    }
    if provider:
        llm_input["llm_provider"] = provider
    llm_resp = await shinkai_llm_prompt_processor(llm_input)
    try:
        titles_json = llm_resp["message"].strip()
        if titles_json.startswith('[') and titles_json.endswith(']'):
            selected_titles = json.loads(titles_json)
        else:
            selected_titles = []
    except:
        selected_titles = []

    output.fitting_results = []
    output.fallback_links = []

    if selected_titles:
        for title in selected_titles:
            page_title = title.replace(" ", "_")
            page_url = f"https://grokipedia.com/page/{page_title}"
            page_result = await download_pages({"url": page_url})
            md_content = page_result["markdown"]
            output.fitting_results.append({"title": title, "content": md_content})
    else:
        # Fallback to top N links (default and max 10) if no fitting articles identified
        top_prompt = f"""From the following Grokipedia search results markdown, extract the top {top_n} most related article titles.

The titles start after "yielded XX results:" and are each on new lines.

Output ONLY a valid JSON array of the first {top_n} titles, exactly as they appear, e.g., ["Title1", "Title2", ...] or [] if none.

Markdown:
{search_md}"""
        top_llm_input = {
            "prompt": top_prompt,
            "format": "text"
        }
        if provider:
            top_llm_input["llm_provider"] = provider
        top_llm_resp = await shinkai_llm_prompt_processor(top_llm_input)
        try:
            top_titles_json = top_llm_resp["message"].strip()
            top_titles = json.loads(top_titles_json)
        except:
            top_titles = []
        for title in top_titles:
            page_title = title.replace(" ", "_")
            url = f"https://grokipedia.com/page/{page_title}"
            output.fallback_links.append(url)

    if len(output.fitting_results) > 0:
        output.status = "Best fitting articles identified"
    elif len(output.fallback_links) > 0:
        output.status = "No fitting articles identified. Fallback links for related articles provided"
    else:
        output.status = "No article found"

    return output