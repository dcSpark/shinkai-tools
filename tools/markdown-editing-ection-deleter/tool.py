# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict, Tuple
import os
import re
import json
from shinkai_local_tools import shinkai_llm_prompt_processor

class CONFIG:
    pass

class INPUTS:
    prompt: str
    md_file_path: str

class OUTPUT:
    updated_file_path: Optional[str] = None
    action_done: Optional[str] = None
    original_content_of_the_deleted_section: Optional[str] = None

def parse_md_sections(md_content: str):
    lines = md_content.splitlines(keepends=True)
    headings = []
    for i, line in enumerate(lines):
        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            headings.append((i, level, title))
    if not headings:
        return [{
            "level": 0,
            "title": "",
            "content": md_content,
            "start_idx": 0,
            "end_idx": len(md_content),
            "subsections": []
        }]
    line_start_char_indices = []
    char_count = 0
    for line in lines:
        line_start_char_indices.append(char_count)
        char_count += len(line)
    sections = []
    for i, (line_idx, level, title) in enumerate(headings):
        start_idx = line_start_char_indices[line_idx]
        if i + 1 < len(headings):
            next_line_idx = headings[i + 1][0]
            end_idx = line_start_char_indices[next_line_idx]
        else:
            end_idx = len(md_content)
        content = md_content[start_idx:end_idx]
        sections.append({
            "level": level,
            "title": title,
            "content": content,
            "start_idx": start_idx,
            "end_idx": end_idx,
            "subsections": []
        })

    def build_hierarchy(secs: List[Dict]) -> List[Dict]:
        result = []
        stack = []
        for sec in secs:
            while stack and stack[-1]["level"] >= sec["level"]:
                stack.pop()
            if stack:
                stack[-1]["subsections"].append(sec)
            else:
                result.append(sec)
            stack.append(sec)
        return result

    hierarchical_sections = build_hierarchy(sections)
    return hierarchical_sections

def flatten_sections_for_prompt_with_refs(sections: List[Dict], parent_titles: List[str] = None) -> List[Tuple[Dict, Dict]]:
    if parent_titles is None:
        parent_titles = []
    result = []
    for sec in sections:
        full_title = " > ".join(parent_titles + [sec["title"]]) if sec["title"] else "(root)"
        flat = {
            "full_title": full_title,
            "level": sec["level"],
            "content": sec["content"],
            "start_idx": sec["start_idx"],
            "end_idx": sec["end_idx"],
        }
        result.append((flat, sec))
        if sec.get("subsections"):
            result.extend(flatten_sections_for_prompt_with_refs(sec["subsections"], parent_titles + [sec["title"]]))
    return result

def get_section_full_range(section: Dict) -> Tuple[int, int]:
    start = section["start_idx"]
    max_end = section["end_idx"]

    def traverse(subsec):
        nonlocal max_end
        for s in subsec.get("subsections", []):
            if s["end_idx"] > max_end:
                max_end = s["end_idx"]
            traverse(s)
    traverse(section)
    return start, max_end

async def find_most_relevant_section(sections_flat: List[Dict], prompt: str) -> Optional[int]:
    if not sections_flat:
        return None
    sections_description = "\n".join(
        [f"{i}: Title: '{sec['full_title']}', Content (first 100 chars): '{sec['content'][:100].replace(chr(10), ' ')}...'" for i, sec in enumerate(sections_flat)]
    )
    llm_prompt = (
        f"You are helping to select the most relevant markdown section for the user query.\n"
        f"User query: {prompt}\n"
        f"Here are the markdown sections:\n{sections_description}\n"
        f"Output a JSON object with two keys:\n"
        f" - 'relevant': true if any section is relevant, false otherwise.\n"
        f" - 'section_index': index of the most relevant section if relevant is true, else null.\n"
        f"Only output the JSON object, no extra text.\n"
    )
    response = await shinkai_llm_prompt_processor({"format": "json", "prompt": llm_prompt})
    message = response.get("message", "").strip("```json\n").strip()
    try:
        result = json.loads(message)
        if result.get("relevant") is True and isinstance(result.get("section_index"), int):
            idx = result["section_index"]
            if 0 <= idx < len(sections_flat):
                return idx
        return None
    except Exception:
        return None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()

    md_file_path = inputs.md_file_path
    if not md_file_path or not isinstance(md_file_path, str) or md_file_path.strip() == "":
        output.action_done = "No valid markdown file path provided."
        return output

    if not os.path.exists(md_file_path):
        output.action_done = f"File does not exist: {md_file_path}"
        return output

    try:
        with open(md_file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
    except Exception as e:
        output.action_done = f"Failed to read file {md_file_path}: {str(e)}"
        return output

    if not md_content.strip():
        output.action_done = "File is empty, nothing to delete."
        return output

    sections = parse_md_sections(md_content)
    flat_with_refs = flatten_sections_for_prompt_with_refs(sections)
    sections_flat = [item[0] for item in flat_with_refs]
    section_refs = [item[1] for item in flat_with_refs]

    prompt = inputs.prompt.strip()
    lower_prompt = prompt.lower()
    if not any(word in lower_prompt for word in ["delete", "remove", "erase"]):
        output.action_done = "Prompt does not indicate a delete action."
        return output

    relevant_idx = await find_most_relevant_section(sections_flat, prompt)
    if relevant_idx is None:
        output.action_done = "No relevant section found to delete."
        return output
    target_sec = section_refs[relevant_idx]
    start_idx, end_idx = get_section_full_range(target_sec)
    section_title = sections_flat[relevant_idx]["full_title"]
    section_content = md_content[start_idx:end_idx]

    full_text = md_content
    new_md_content = full_text[:start_idx] + full_text[end_idx:]

    try:
        with open(md_file_path, "w", encoding="utf-8") as f:
            f.write(new_md_content)
        output.updated_file_path = md_file_path
        output.action_done = f"Deleted section titled '{section_title}' and all its sub-sections."
        output.original_content_of_the_deleted_section = section_content
        return output
    except Exception as e:
        output.action_done = f"Failed to write updated file: {str(e)}"
        return output