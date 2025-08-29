# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
import os
import re
import json
from shinkai_local_tools import shinkai_llm_prompt_processor

class CONFIG:
    pass

class INPUTS:
    prompt: str
    md_file_path: str
    # A yes/no string to include the deterministically numbered titles in the output.
    # This is useful for debugging the intermediate numbering step before the LLM call.
    show_intermediary_output: str = "no"

class OUTPUT:
    updated_file_path: Optional[str] = None
    action_done: Optional[str] = None
    original_titles: Optional[List[str]] = None
    intermediary_deterministic_numbered_titles: Optional[List[str]] = None
    final_llm_formatted_section_titles: Optional[List[str]] = None
    error_message: Optional[str] = None

def extract_section_titles(md_content: str) -> List[Dict[str, Any]]:
    lines = md_content.splitlines(keepends=True)
    titles = []
    for i, line in enumerate(lines):
        m = re.match(r'^(#{1,6})\s+(.*?)(\s*)$', line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            titles.append({
                "level": level,
                "title": title,
                "line_idx": i,
                "line_content": line
            })
    return titles

def assign_hierarchical_numbers(titles_info: List[Dict[str, Any]]) -> List[Optional[str]]:
    counters = [0] * 6
    numbered_list = []
    level1_count = sum(1 for t in titles_info if t["level"] == 1)
    is_single_h1_case = level1_count == 1
    first_h1_processed = False

    for t in titles_info:
        level = t["level"]
        if is_single_h1_case and level == 1 and not first_h1_processed:
            numbered_list.append(None)
            first_h1_processed = True
            continue
        counters[level - 1] += 1
        for i in range(level, len(counters)):
            counters[i] = 0
        numbering_parts = [str(c) for c in counters[:level] if c > 0]
        numbering_str = ".".join(numbering_parts) + "."
        numbered_list.append(numbering_str)
    return numbered_list

def prefix_numbering_to_titles(titles_info: List[Dict[str, Any]], numbering: List[Optional[str]]) -> List[str]:
    result = []
    for t, num in zip(titles_info, numbering):
        original_title = t["title"]
        if num is None:
            result.append(original_title)
        else:
            result.append(f"{num} {original_title}")
    return result

def build_prompt_for_formatting(deterministic_numbered_titles: List[str], user_prompt: str) -> str:
    titles_list_str = "\n".join(f"- {line}" for line in deterministic_numbered_titles)
    example_input = (
        "Example of Correct Reformatting:\n"
        "Input Titles:\n"
        "- Main Title\n"
        "- 1. 1. General Information\n"
        "- 2. 2. Overview\n"
        "- 2.1. 2.1. Details\n"
        "- 3. 2024 Project Goals\n\n"
        "Expected JSON Output:\n"
        '["Main Title", "1. General Information", "2. Overview", "2.1. Details", "3. 2024 Project Goals"]'
    )
    prompt = (
        "You are a Markdown formatting expert. Your task is to reformat a list of section titles based on a user's instruction, while strictly preserving their content and hierarchical structure.\n\n"
        "**Input Titles to Process:**\n"
        f"{titles_list_str}\n\n"
        "**CRITICAL RULES:**\n"
        "1.  **Preserve Unnumbered Titles:** If a title in the input list does NOT have a new numbering prefix (like '1.1.'), it MUST remain unnumbered in your output.\n"
        "2.  **Clean Up Numbers:** Each input line may have TWO numbers: a new prefix (e.g., '1.1. ') and an old number within the title itself (e.g., '1. Old Title'). Your job is to **use the new prefix** and **discard the old number** from the title text.\n"
        "3.  **Keep Legitimate Numbers:** If a title's text contains a number that is NOT a hierarchical prefix (e.g., '2024 Goals', 'Version 5'), you must keep it.\n"
        "4.  **Apply User Formatting:** Reformat the new numbering prefix according to the user's specific instruction below.\n"
        "5.  **Maintain Integrity:** The number of titles, their exact text (aside from numbering), and their order MUST NOT be changed.\n"
        "6.  **Output Format:** Your final output must be ONLY a JSON array of strings.\n\n"
        f"**{example_input}\n\n**"
        "**User's Instruction for Numbering Style:**\n"
        f"{user_prompt.strip() if user_prompt.strip() else 'Keep the numbering as is, like 1., 2.1., 2.1.1., etc.'}\n\n"
        "Produce the JSON array now."
    )
    return prompt

def replace_section_titles_in_content(md_content: str, titles_info: List[Dict[str, Any]], new_titles: List[str]) -> str:
    lines = md_content.splitlines(keepends=True)
    if len(titles_info) != len(new_titles):
        raise ValueError("Number of new titles does not match original titles count")
    for i in sorted(range(len(titles_info)), reverse=True):
        title_info = titles_info[i]
        line_idx = title_info["line_idx"]
        old_line = lines[line_idx]
        m = re.match(r'^(#{1,6})(\s*)(.*?)(\s*)$', old_line)
        if not m:
            continue
        hashes = m.group(1)
        spacing = m.group(2) if m.group(2) else ' '
        trailing_space = m.group(4)
        new_title = new_titles[i]
        new_line = f"{hashes}{spacing}{new_title}{trailing_space}"
        lines[line_idx] = new_line
    return "".join(lines)

async def call_llm_with_retries(prompt: str, max_retries: int = 2) -> (Optional[List[str]], Optional[str]):
    for attempt in range(max_retries + 1):
        response = await shinkai_llm_prompt_processor({"format": "text", "prompt": prompt})
        message = response.get("message", "").strip()
        cleaned = message
        if cleaned.startswith("```json"):
            cleaned = cleaned[len("```json"):].strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
                return parsed, None
            else:
                error_msg = f"LLM output JSON is not a list of strings."
        except Exception as e:
            error_msg = f"Failed to parse LLM output as JSON: {str(e)}"
        if attempt < max_retries:
            prompt = (
                f"The previous output was invalid: {error_msg}\n"
                "Please try again. Output ONLY a valid JSON array of strings. Do not include any other text or markdown formatting. "
                "The number of titles must be the same as the input. Do not add numbering to titles that were unnumbered in the input."
            )
        else:
            return None, error_msg
    return None, "Unknown error in LLM processing"

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    md_file_path = inputs.md_file_path
    user_prompt = inputs.prompt.strip()

    if not md_file_path or not isinstance(md_file_path, str) or not os.path.exists(md_file_path):
        output.action_done = "Invalid or non-existent markdown file path provided."
        output.error_message = "File path is invalid or does not exist."
        return output

    try:
        with open(md_file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
    except Exception as e:
        output.action_done = f"Failed to read file '{md_file_path}': {str(e)}"
        output.error_message = str(e)
        return output

    if not md_content.strip():
        output.action_done = "Markdown file is empty."
        output.error_message = "Empty markdown content."
        return output

    titles_info = extract_section_titles(md_content)
    if not titles_info:
        output.action_done = "No section titles found in markdown file."
        output.error_message = "No markdown headers found."
        return output

    original_titles = [t["title"] for t in titles_info]
    output.original_titles = original_titles

    numbering = assign_hierarchical_numbers(titles_info)
    deterministic_numbered_titles = prefix_numbering_to_titles(titles_info, numbering)

    # Conditionally add the intermediary output for debugging
    if inputs.show_intermediary_output and inputs.show_intermediary_output.lower() == 'yes':
        output.intermediary_deterministic_numbered_titles = deterministic_numbered_titles

    llm_prompt = build_prompt_for_formatting(deterministic_numbered_titles, user_prompt)

    llm_formatted_titles, error_msg = await call_llm_with_retries(llm_prompt, max_retries=2)

    if llm_formatted_titles is None:
        output.action_done = "Failed to get valid reformatted section titles from LLM."
        output.error_message = error_msg
        return output

    if len(llm_formatted_titles) != len(original_titles):
        output.action_done = "LLM returned a different number of section titles than the original."
        output.error_message = f"Original count: {len(original_titles)}, New count: {len(llm_formatted_titles)}"
        return output

    output.final_llm_formatted_section_titles = llm_formatted_titles

    try:
        new_md_content = replace_section_titles_in_content(md_content, titles_info, llm_formatted_titles)
    except Exception as e:
        output.action_done = "Failed to replace section titles in markdown content."
        output.error_message = str(e)
        return output

    try:
        with open(md_file_path, "w", encoding="utf-8") as f:
            f.write(new_md_content)
        output.updated_file_path = md_file_path
        output.action_done = "Section titles reformatted successfully."
        return output
    except Exception as e:
        output.action_done = "Failed to write updated markdown file."
        output.error_message = str(e)
        return output