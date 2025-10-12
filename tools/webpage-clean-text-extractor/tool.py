# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Optional
from shinkai_local_support import get_home_path
from urllib.parse import urlparse
from datetime import datetime
import requests
import os
import re


class CONFIG:
    pass


class INPUTS:
    url: str
    show_content: Optional[bool] = None
    timeout_seconds: Optional[int]


class OUTPUT:
    url: str
    status_code: int
    ok: bool
    content: Optional[str]
    error: Optional[str]


def _ensure_http_scheme(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://{url}"


def _build_reader_url(url: str) -> str:
    if url.startswith("https://r.jina.ai/"):
        return url
    return f"https://r.jina.ai/{url}"


def _sanitize_filename(name: str) -> str:
    name = re.sub(r"[^\w\-.]+", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name or "content"


def _derive_filename(url: str) -> str:
    parsed = urlparse(url)
    host = _sanitize_filename(parsed.netloc) or "page"
    path = _sanitize_filename(parsed.path.replace("/", "_"))
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    core = "_".join([p for p in [host, path] if p]) or host
    return f"{core}_{ts}.txt"


async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()

    timeout_seconds = getattr(inputs, "timeout_seconds", None) or 30

    original_url = _ensure_http_scheme(inputs.url.strip())
    reader_url = _build_reader_url(original_url)

    status_code = 0
    text_content: Optional[str] = None
    error_msg: Optional[str] = None

    try:
        resp = requests.get(reader_url, timeout=timeout_seconds)
        status_code = resp.status_code
        if resp.status_code == 200:
            text_content = resp.text
        else:
            error_msg = f"Failed to retrieve content. Status code: {resp.status_code}"
    except requests.exceptions.RequestException as e:
        error_msg = f"An error occurred: {e}"

    try:
        if text_content:
            home = await get_home_path()
            filename = _derive_filename(original_url)
            saved_path = os.path.join(home, filename)
            with open(saved_path, "w", encoding="utf-8") as f:
                f.write(text_content)
    except Exception as fe:
        if not error_msg:
            error_msg = f"Failed to write file: {fe}"

    show_content = True if inputs.show_content is None else bool(inputs.show_content)

    output.url = original_url
    output.status_code = status_code
    output.ok = (status_code == 200) and (text_content is not None)
    output.content = text_content if (show_content and text_content is not None) else None
    output.error = error_msg

    return output