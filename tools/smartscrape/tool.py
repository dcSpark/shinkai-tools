# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional
from shinkai_local_tools import shinkai_llm_prompt_processor, download_pages

class CONFIG:
    url: Optional[str] = None
    # Single free-text extraction instruction describing what to extract from the page.
    extract_instructions: Optional[str] = None
    # Free-text describing example output format(s) the LLM should follow (e.g., "Return lines as: field: value")
    format_instructions: Optional[str] = None

class INPUTS:
    url: Optional[str] = None
    extract_instructions: Optional[str] = None
    format_instructions: Optional[str] = None

class OUTPUT:
    # Raw LLM response text
    llm_message: str
    # Simple status: "ok" or "error"
    status: str
    # Optional error message
    error: Optional[str] = None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()

    # Resolve url and single extract instruction, with inputs overriding config
    url = inputs.url if getattr(inputs, "url", None) else getattr(config, "url", None)
    extract_instructions = (inputs.extract_instructions if getattr(inputs, "extract_instructions", None)
                            else getattr(config, "extract_instructions", None))
    format_instructions = inputs.format_instructions if getattr(inputs, "format_instructions", None) else getattr(config, "format_instructions", None)

    # Validate required parameters
    missing = []
    if not url:
        missing.append("url")
    if not extract_instructions or extract_instructions.strip() == "":
        missing.append("extract_instructions")

    if missing:
        output.llm_message = ""
        output.status = "error"
        output.error = f"Missing required configuration: {', '.join(missing)}. Provide them in inputs or config."
        return output

    # Download page content
    try:
        download_result = await download_pages({"url": url})
        page_content = download_result.get("markdown", "") or ""
    except Exception as e:
        output.llm_message = ""
        output.status = "error"
        output.error = f"Failed to download page: {str(e)}"
        return output

    # Build prompt using single instruction string
    prompt_lines = [
        "You will be given the Markdown/HTML content of a web page enclosed below.",
        "Extract the information exactly as specified in the instruction below. Be concise and do not add extra commentary.",
        "If a requested item is not present, indicate that clearly (e.g., 'NOT FOUND').",
        "Extraction instruction:",
        extract_instructions.strip()
    ]
    if format_instructions and format_instructions.strip():
        prompt_lines.extend([
            "Format instructions (follow these examples):",
            format_instructions.strip()
        ])

    prompt_lines.extend([
        "PAGE CONTENT START",
        "```",
        page_content,
        "```",
        "PAGE CONTENT END",
        "Return only the extracted content following the format instructions or the instruction."
    ])

    prompt = "\n\n".join(prompt_lines)

    try:
        llm_result = await shinkai_llm_prompt_processor({
            "format": "text",
            "prompt": prompt
        })
        llm_message = llm_result.get("message", "") or ""
        output.llm_message = llm_message
        output.status = "ok"
        output.error = None
    except Exception as e:
        output.llm_message = ""
        output.status = "error"
        output.error = f"LLM call failed: {str(e)}"

    return output