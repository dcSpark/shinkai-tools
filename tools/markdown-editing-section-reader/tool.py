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
    file_path: Optional[str] = None
    section_title: Optional[str] = None
    section_content: Optional[str] = None
    section_full_hierarchy: Optional[List[str]] = None
    explanation: Optional[str] = None

def parse_md_sections(md_content: str):
    # Parse markdown headings and return a flat list with start/end indices and parent links
    lines = md_content.splitlines(keepends=True)
    heading_infos = []
    for i, line in enumerate(lines):
        m = re.match(r'^(#{1,6})\s*(.*)$', line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            heading_line = line.rstrip('\n')
            heading_infos.append({
                "line_idx": i,
                "level": level,
                "title": title,
                "heading_line": heading_line,
            })
    # Always include a dummy "root" if there are no headings
    if not heading_infos:
        return [{
            "level": 0,
            "title": "",
            "heading_line": "",
            "content": md_content,
            "start_idx": 0,
            "end_idx": len(md_content),
            "parent_indices": []
        }]
    # Get char offset for each line
    line_start_char_indices = []
    char_count = 0
    for line in lines:
        line_start_char_indices.append(char_count)
        char_count += len(line)
    # Build sections with start/end char indices
    sections = []
    for idx, h in enumerate(heading_infos):
        level = h["level"]
        title = h["title"]
        heading_line = h["heading_line"]
        line_idx = h["line_idx"]
        start_idx = line_start_char_indices[line_idx]
        # Find next heading of level <= this one, or end of file
        next_start = len(md_content)
        for j in range(idx + 1, len(heading_infos)):
            if heading_infos[j]["level"] <= level:
                next_line_idx = heading_infos[j]["line_idx"]
                next_start = line_start_char_indices[next_line_idx]
                break
        end_idx = next_start
        sections.append({
            "idx": idx,
            "level": level,
            "title": title,
            "heading_line": heading_line,
            "start_idx": start_idx,
            "end_idx": end_idx,
            "parent_idx": None,   # to be filled
        })
    # Set parent_idx for each section
    for idx, sec in enumerate(sections):
        # The parent is the nearest previous heading of lower level
        parent_idx = None
        for j in range(idx - 1, -1, -1):
            if sections[j]["level"] < sec["level"]:
                parent_idx = j
                break
        sec["parent_idx"] = parent_idx
    return sections

def flatten_section_hierarchy(sections: List[Dict]) -> List[Dict]:
    # For each section, produce its parent chain (list of heading_lines of its parents, root-first)
    flat = []
    for sec in sections:
        hierarchy = []
        parent_idx = sec.get("parent_idx")
        while parent_idx is not None:
            parent = sections[parent_idx]
            hierarchy.append(parent["heading_line"])
            parent_idx = parent.get("parent_idx")
        hierarchy = list(reversed(hierarchy))
        flat.append({
            "section": sec,
            "section_full_hierarchy": hierarchy
        })
    return flat

async def find_most_relevant_section(flat_sections: List[Dict], prompt: str) -> Optional[int]:
    if not flat_sections:
        return None
    # Give LLM a description of each section (title and first 100 chars of content)
    sections_description = "\n".join(
        [f"{i}: Title: '{s['section']['title']}', Heading: '{s['section']['heading_line']}', Content (first 100 chars): '{s['section']['start_idx']}-{s['section']['end_idx']} {'' if s['section']['start_idx'] == s['section']['end_idx'] else ''}{prompt[:0]}...'" for i, s in enumerate(flat_sections)]
    )
    # For better LLM selection, actually preview the content
    preview_lines = []
    for i, s in enumerate(flat_sections):
        sec = s['section']
        # Only show first 100 chars for the preview
        preview_content = ""
        if "full_md_content" in s:
            preview_content = s["full_md_content"][sec["start_idx"]:sec["end_idx"]][:100].replace('\n', ' ')
        else:
            preview_content = ""
        preview_lines.append(
            f"{i}: Title: '{sec['title']}', Heading: '{sec['heading_line']}', Content (first 100 chars): '{preview_content}...'"
        )
    sections_description = "\n".join(preview_lines)
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
            if 0 <= idx < len(flat_sections):
                return idx
        return None
    except Exception:
        return None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    md_file_path = inputs.md_file_path
    output.file_path = md_file_path

    if not md_file_path or not isinstance(md_file_path, str) or md_file_path.strip() == "":
        output.explanation = "No valid markdown file path provided."
        return output

    if not os.path.exists(md_file_path):
        output.explanation = f"File not found: {md_file_path}"
        return output

    try:
        with open(md_file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
    except Exception as e:
        output.explanation = f"Failed to read file {md_file_path}: {str(e)}"
        return output

    sections = parse_md_sections(md_content)
    for sec in sections:
        sec["full_md_content"] = md_content
    flat_sections = flatten_section_hierarchy(sections)
    # Add full_md_content for previewing in LLM prompt
    for s in flat_sections:
        s["full_md_content"] = md_content

    prompt = inputs.prompt.strip()
    if not prompt:
        output.explanation = "No prompt provided to select a section."
        return output

    relevant_idx = await find_most_relevant_section(flat_sections, prompt)
    if relevant_idx is None:
        output.explanation = "No relevant section found for the given prompt."
        return output

    selected = flat_sections[relevant_idx]
    section = selected["section"]

    output.section_title = section.get("heading_line", "")
    output.section_content = md_content[section["start_idx"]:section["end_idx"]]
    output.section_full_hierarchy = selected.get("section_full_hierarchy", [])

    return output