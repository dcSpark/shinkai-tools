# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
import re
import json

from shinkai_local_tools import shinkai_llm_prompt_processor, download_pages

class CONFIG:
    pass

class INPUTS:
    search_query: Optional[str] = None  # (str) Book title, author, etc. Required.
    file_type: Optional[str] = None     # (str) "pdf", "epub", "cbr", "cbz", None for all. Default: None
    sort: Optional[str] = None          # (str) "newest", "oldest", "largest", "smallest", None/"". Default: None
    category: Optional[str] = None      # (str) "", "book_any", "book_unknown", "book_fiction", "book_nonfiction", "book_comic", "magazine", "standards_document", "journal_article". Default: None
    num_results: Optional[int] = None   # (int) how many relevant results to return. Optional. Default: 5

class OUTPUT:
    results: Optional[List[dict]] = None
    error: Optional[str] = None
    output_reading_instructions: Optional[str] = None

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36"
)
BASE_URL = "https://annas-archive.li/"

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

def _extract_md5_from_page_url(page_url: Optional[str]) -> Optional[str]:
    if not page_url:
        return None
    match = re.search(r'/md5/([a-fA-F0-9]{32})', page_url)
    if match:
        return match.group(1)
    end_match = re.search(r'([a-fA-F0-9]{32})/?$', page_url)
    if end_match:
        return end_match.group(1)
    return None

def _ensure_absolute(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return BASE_URL.rstrip("/") + url
    return url

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.output_reading_instructions = (
        "When using this tool, make sure to show to the user the clickable page url link for each book found (copy paste it from 'page_url'). Also include the thumbnail if available, using the format ![Alt text for the image](URL_of_the_image)."
    )

    valid_categories = {
        "", "book_any", "book_unknown", "book_fiction", "book_nonfiction",
        "book_comic", "magazine", "standards_document", "journal_article"
    }
    valid_sorts = {"newest", "oldest", "largest", "smallest", "", None}
    valid_file_types = {"pdf", "epub", "cbr", "cbz", None}

    errors: List[str] = []

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

    # Validate num_results
    num_results = 5
    if inputs.num_results is not None:
        try:
            nr = int(inputs.num_results)
            if nr <= 0:
                errors.append("num_results must be a positive integer.")
            else:
                num_results = nr
        except Exception:
            errors.append("num_results must be an integer.")

    if errors:
        output.error = "Validation errors:\n" + "\n".join(errors)
        return output

    if not inputs.search_query:
        output.error = "Please provide a search_query for searching books."
        return output

    try:
        # Build search URL
        url = _book_search_url(
            query=inputs.search_query,
            file_type=inputs.file_type,
            sort=inputs.sort,
            category=inputs.category,
        )

        # Use download_pages tool instead of scraping directly
        dl_resp = await download_pages({"url": url})
        if not isinstance(dl_resp, dict) or "markdown" not in dl_resp:
            output.error = "download_pages tool did not return expected markdown content."
            return output
        markdown = dl_resp.get("markdown", "")

        # Prepare improved prompt for the LLM to extract structured data and choose most relevant items
        prompt = (
            "You are given the MARKDOWN content of a search results page from annas-archive.org and the original user query.\n"
            "Context:\n"
            f"- ORIGINAL_QUERY: {inputs.search_query}\n"
            f"- DESIRED_NUMBER_OF_RESULTS: {num_results}\n\n"
            "Task:\n"
            "1) Parse the MARKDOWN content and identify individual book/item entries on the page.\n"
            "2) From those entries, select the most relevant results to the ORIGINAL_QUERY, up to DESIRED_NUMBER_OF_RESULTS.\n"
            "   - Relevance should be based on title, author, and other metadata present. Prefer exact or close matches to the query.\n"
            "3) For each selected book produce the following fields:\n"
            "   - title (string)\n"
            "   - author (string or null)\n"
            "   - date (string or null)\n"
            "   - format (string, e.g., pdf, epub, cbz, cbr, or null)\n"
            "   - size (string or null, e.g., '12 MB')\n"
            "   - page_url (full clickable URL to the book's page)\n"
            "   - thumbnail (markdown image insertion format: ![Alt text for the image](URL_of_the_image) or null)\n"
            "   - language (string or null)\n"
            "   - MD5 (32 hex string if available, otherwise null)\n\n"
            "Output requirements:\n"
            " - Return a single JSON object with one key 'results' that is an array of objects with the fields listed above.\n"
            " - The array must contain at most DESIRED_NUMBER_OF_RESULTS items (use fewer only if fewer entries are found).\n"
            " - Example: {\"results\": [{\"title\": \"...\", \"author\": \"...\", \"date\": \"...\", \"format\": \"pdf\", \"size\": \"12 MB\", \"page_url\": \"https://...\", \"thumbnail\": \"![Alt text](https://...)\", \"language\": \"English\", \"MD5\": \"...\"}, ...]}\n"
            " - Only output valid JSON and nothing else. Do not include explanations.\n\n"
            "Now extract and select from the MARKDOWN content below. Be careful to return full absolute URLs for page_url, and to return ![Alt text for the image](URL_of_the_image) for the thumbnail when possible. Also include the language of the book if available.\n\n"
            "MARKDOWN_CONTENT_START\n"
            f"{markdown}\n"
            "MARKDOWN_CONTENT_END\n"
        )

        llm_resp = await shinkai_llm_prompt_processor({"prompt": prompt, "format": "text"})
        if not isinstance(llm_resp, dict) or "message" not in llm_resp:
            output.error = "LLM tool did not return expected message."
            return output
        message = llm_resp.get("message", "")

        # Try to extract JSON from message
        data_obj = None
        try:
            data_obj = json.loads(message)
        except Exception:
            json_match = re.search(r"(\{(?:.|\s)*\})", message)
            if json_match:
                json_text = json_match.group(1)
                try:
                    data_obj = json.loads(json_text)
                except Exception:
                    data_obj = None

        if data_obj is None:
            output.error = "Failed to parse JSON returned by LLM."
            return output

        # Normalize results to list
        results_list: List[dict] = []
        if isinstance(data_obj, dict) and "results" in data_obj and isinstance(data_obj["results"], list):
            results_list = data_obj["results"]
        elif isinstance(data_obj, list):
            results_list = data_obj
        else:
            output.error = "Parsed JSON does not contain a 'results' array."
            return output

        # Ensure we return at most num_results items
        results_list = results_list[:num_results]

        # Post-process each result: ensure keys exist and URLs absolute, MD5 present if possible
        normalized: List[dict] = []
        for item in results_list:
            if not isinstance(item, dict):
                continue
            title = item.get("title")
            author = item.get("author")
            date = item.get("date")
            fmt = item.get("format")
            size = item.get("size")
            page_url = _ensure_absolute(item.get("page_url"))
            thumbnail = item.get("thumbnail")
            # If thumbnail is a markdown image insertion like ![Alt](URL), try to extract URL then make absolute
            if isinstance(thumbnail, str):
                md_url_match = re.search(r'\((https?:\/\/[^\)]+)\)', thumbnail)
                if md_url_match:
                    extracted = md_url_match.group(1)
                    abs_extracted = _ensure_absolute(extracted)
                    # Rebuild the markdown image syntax with absolute URL
                    thumbnail = re.sub(r'\((https?:\/\/[^\)]+)\)', f'({abs_extracted})', thumbnail)
                else:
                    # If thumbnail is just a URL, make it absolute and wrap into markdown format
                    if thumbnail.startswith("http://") or thumbnail.startswith("https://") or thumbnail.startswith("//") or thumbnail.startswith("/"):
                        abs_thumb = _ensure_absolute(thumbnail)
                        thumbnail = f"![Thumbnail]({abs_thumb})"
            else:
                thumbnail = None

            language = item.get("language")
            md5 = item.get("MD5") or _extract_md5_from_page_url(page_url)

            normalized_item = {
                "title": title,
                "author": author,
                "date": date,
                "format": fmt,
                "size": size,
                "page_url": page_url,
                "thumbnail": thumbnail,
                "language": language,
                "MD5": md5,
            }
            normalized.append(normalized_item)

        output.results = normalized
        return output

    except Exception as e:
        output.error = f"Failed to search/process: {e}"
        return output