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
    action_details: Optional[str] = None
    moved_section_details: Optional[str] = None

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
            "title": sec["title"],
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

def extract_insert_location_from_prompt(prompt: str) -> str:
    prompt_lower = prompt.lower()
    before_keywords = ["before", "above", "prior to", "earlier than"]
    after_keywords = ["after", "below", "following", "later than"]
    for kw in before_keywords:
        if kw in prompt_lower:
            return "before"
    for kw in after_keywords:
        if kw in prompt_lower:
            return "after"
    return "after"

async def find_section_index_by_prompt(sections_flat: List[Dict], prompt: str, role: str) -> Optional[int]:
    if not sections_flat: return None
    sections_description = "\n".join([f"{i}: Title: '{sec['full_title']}'" for i, sec in enumerate(sections_flat)])
    instruction = ("Identify the section the user wants to move." if role == "source" else "Identify the destination section for the move.")
    llm_prompt = (
        f"User instruction: {prompt}\n\n"
        f"Task: {instruction}\n\n"
        f"Sections:\n{sections_description}\n\n"
        f"Output a JSON object with one key, 'section_index', which is the index of the most relevant section, or null if none are relevant."
    )
    response = await shinkai_llm_prompt_processor({"format": "json", "prompt": llm_prompt})
    message = response.get("message", "").strip("```json\n").strip()
    try:
        result = json.loads(message)
        if isinstance(result.get("section_index"), int):
            idx = result["section_index"]
            if 0 <= idx < len(sections_flat):
                return idx
        return None
    except Exception: return None

async def propose_new_heading_for_move(
    prompt: str,
    source_section: Dict,
    target_section: Optional[Dict],
    move_position: str
) -> Dict[str, Any]:
    source_heading = f"{'#' * source_section['level']} {source_section['title']}"
    
    if target_section:
        context = (f"The section will be moved {move_position} the destination section "
                   f"\"{'#' * target_section['level']} {target_section['title']}\".")
    else:
        context = f"The section will be moved to the {move_position} of the document."

    llm_prompt = (
        f"You are an expert in restructuring Markdown. A user wants to move a section. "
        f"Your task is to decide if the moved section's heading level should be changed to fit its new location.\n\n"
        f"USER REQUEST: \"{prompt}\"\n"
        f"SECTION TO MOVE: \"{source_heading}\" (currently level {source_section['level']})\n"
        f"DESTINATION CONTEXT: {context}\n\n"
        f"ANALYSIS:\n"
        f"1. Should the heading level be changed? For example, moving a sub-subsection (level 4) to be a main section (level 2) requires re-leveling. Moving a level 2 section to be next to another level 2 section does not.\n"
        f"2. If re-leveling, what is the new, complete heading line? The title should remain similar.\n\n"
        f"Output a JSON object with two keys:\n"
        f" - 'relevel': boolean (true if the heading level should change, false otherwise).\n"
        f" - 'new_heading_line': string (the new complete heading line if 'relevel' is true, otherwise null)."
    )
    
    response = await shinkai_llm_prompt_processor({"format": "json", "prompt": llm_prompt})
    message = response.get("message", '{"relevel": false, "new_heading_line": null}').strip("```json\n").strip()
    try:
        return json.loads(message)
    except Exception:
        return {"relevel": False, "new_heading_line": None}

def adjust_heading_levels(md_content: str, delta: int) -> str:
    if delta == 0:
        return md_content
    
    new_lines = []
    for line in md_content.splitlines():
        match = re.match(r"^(#{1,6})\s+(.*)$", line)
        if match:
            current_level = len(match.group(1))
            new_level = max(1, min(6, current_level + delta))
            new_lines.append(f"{'#' * new_level} {match.group(2)}")
        else:
            new_lines.append(line)
    return "\n".join(new_lines)


async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    md_file_path = inputs.md_file_path
    if not os.path.exists(md_file_path):
        output.action_done = f"Markdown file does not exist: {md_file_path}"
        return output

    with open(md_file_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    if len(md_content.strip()) == 0:
        output.action_done = "Markdown file is empty, nothing to move."
        return output

    sections = parse_md_sections(md_content)
    flat_with_refs = flatten_sections_for_prompt_with_refs(sections)
    sections_flat = [item[0] for item in flat_with_refs]
    section_refs = [item[1] for item in flat_with_refs]

    prompt = inputs.prompt.strip()
    source_idx = await find_section_index_by_prompt(sections_flat, prompt, "source")
    if source_idx is None:
        output.action_done = "Could not identify the section to move."
        return output

    target_idx = await find_section_index_by_prompt(sections_flat, prompt, "target")
    if source_idx == target_idx:
        output.action_done = "Source and target sections are the same; no move performed."
        return output

    move_position = extract_insert_location_from_prompt(prompt)
    source_flat = sections_flat[source_idx]
    target_flat = sections_flat[target_idx] if target_idx is not None else None

    # --- Intelligent Re-leveling Logic ---
    relevel_decision = await propose_new_heading_for_move(prompt, source_flat, target_flat, move_position)
    
    source_section_ref = section_refs[source_idx]
    source_start, source_end = get_section_full_range(source_section_ref)
    original_source_content = md_content[source_start:source_end]
    content_to_insert = original_source_content
    releveled = False
    
    if relevel_decision.get("relevel") and relevel_decision.get("new_heading_line"):
        new_heading_line = relevel_decision["new_heading_line"]
        match = re.match(r"^(#+)", new_heading_line)
        if match:
            new_level = len(match.group(1))
            delta = new_level - source_flat['level']
            if delta != 0:
                content_to_insert = adjust_heading_levels(original_source_content, delta)
                releveled = True
    # --- End of Re-leveling Logic ---

    before_source = md_content[:source_start]
    after_source = md_content[source_end:]
    md_without_source = (before_source.rstrip() + "\n\n" + after_source.lstrip()).strip()

    if target_idx is None:
        if move_position == "before":
            new_md_content = content_to_insert.strip() + "\n\n" + md_without_source
            location_desc = "to the beginning of the document"
        else: # "after" or default
            new_md_content = md_without_source + "\n\n" + content_to_insert.strip()
            location_desc = "to the end of the document"
    else:
        # Re-parse the document without the source to find the new, correct target indices
        temp_sections = parse_md_sections(md_without_source)
        temp_flat_with_refs = flatten_sections_for_prompt_with_refs(temp_sections)
        temp_sections_flat = [item[0] for item in temp_flat_with_refs]

        # Find the target section in the temporary content
        new_target_idx = -1
        for i, sec in enumerate(temp_sections_flat):
            # A bit simplistic, but should work for most cases. Compares title and level.
            if sec['title'] == target_flat['title'] and sec['level'] == target_flat['level']:
                new_target_idx = i
                break
        
        if new_target_idx != -1:
            target_section_ref = temp_flat_with_refs[new_target_idx][1]
            temp_target_start, temp_target_end = get_section_full_range(target_section_ref)
            
            if move_position == "before":
                insert_pos = temp_target_start
                new_md_content = (md_without_source[:insert_pos].rstrip() + "\n\n" + content_to_insert.strip() + "\n\n" + md_without_source[insert_pos:].lstrip()).strip()
            else: # "after"
                insert_pos = temp_target_end
                new_md_content = (md_without_source[:insert_pos].rstrip() + "\n\n" + content_to_insert.strip() + "\n\n" + md_without_source[insert_pos:].lstrip()).strip()
            location_desc = f"{move_position} section '{target_flat['full_title']}'"
        else: # Fallback if target can't be found in temp doc
            new_md_content = md_without_source + "\n\n" + content_to_insert.strip()
            location_desc = "to the end of the document (target was ambiguous after removal)"

    with open(md_file_path, "w", encoding="utf-8") as f:
        f.write(new_md_content.strip() + "\n")
        
    output.updated_file_path = md_file_path
    relevel_text = " and re-leveled it" if releveled else ""
    output.action_done = f"Moved section{relevel_text}."
    output.action_details = f"Moved section '{source_flat['full_title']}' {location_desc}{relevel_text}."
    output.moved_section_details = content_to_insert.strip()
    return output