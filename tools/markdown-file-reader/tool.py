# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional
import os

class CONFIG:
    pass

class INPUTS:
    md_file_path: str

class OUTPUT:
    full_markdown_content: Optional[str] = None
    error_message: Optional[str] = None
    file_path: Optional[str] = None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    md_file_path = inputs.md_file_path

    output.file_path = md_file_path

    if not md_file_path or not isinstance(md_file_path, str) or md_file_path.strip() == "":
        output.error_message = "No valid markdown file path provided."
        return output

    if not os.path.exists(md_file_path):
        output.error_message = f"File not found: {md_file_path}"
        return output

    try:
        with open(md_file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
            output.full_markdown_content = md_content
    except Exception as e:
        output.error_message = f"Failed to read file {md_file_path}: {str(e)}"

    return output