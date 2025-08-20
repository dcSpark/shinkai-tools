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
    new_section_details: Optional[str] = None

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

def strip_leading_heading(md_text: str) -> str:
    lines = md_text.lstrip().splitlines()
    i = 0
    while i < len(lines):
        if re.match(r"^#{1,6}\s+.*$", lines[i]):
            i += 1
            while i < len(lines) and lines[i].strip() == "":
                i += 1
            break
        else:
            break
    stripped = "\n".join(lines[i:]).lstrip("\n")
    return stripped

def strip_heading_from_title(title: str) -> str:
    return re.sub(r"^#{1,6}\s*", "", title.strip())

async def propose_section_heading(
    prompt: str,
    context_section: Optional[Dict[str, Any]] = None,
    add_location: str = "end"
) -> str:
    context_text = ""
    if context_section and context_section.get("title"):
        position_word = add_location
        context_text = (
            f"The new section will be placed {position_word} an existing section titled '{context_section['title']}'. "
            f"This existing section is a level {context_section['level']} heading ({'#' * context_section['level']})."
        )
    else:
        context_text = "The new section will be placed in a new or empty document."

    llm_prompt = (
        f"Your task is to create a single, complete markdown heading line (e.g., '### My Title').\n\n"
        f"USER REQUEST: \"{prompt}\"\n\n"
        f"DOCUMENT CONTEXT: {context_text}\n\n"
        f"RULES:\n"
        f"1. Read the user request. If it specifies a heading level (e.g., 'level 3', 'H2', '###'), use that level.\n"
        f"2. If no level is specified, infer the most logical level from the context. The new section could be a sibling (same level), a sub-section (level + 1), or a new higher-level section (level - 1).\n"
        f"3. Create a concise title based on the user request.\n"
        f"4. Output *only* the heading line. Do not add any other text."
    )
    
    response = await shinkai_llm_prompt_processor({"format": "text", "prompt": llm_prompt})
    heading = response.get("message", "## New Section").strip()
    
    if not re.match(r"^#{1,6}\s+", heading):
        clean_title = strip_heading_from_title(heading)
        if not clean_title:
            clean_title = "New Section"
        heading = f"## {clean_title}"

    return heading

async def propose_section_content(prompt: str, parent_heading_level: int) -> str:
    subheading_level = parent_heading_level + 1
    subheading_markdown = "#" * subheading_level

    context_text = (
        f"The content you write will be placed under a level {parent_heading_level} heading. "
        f"If you need to create subsections within your content, you MUST start them at level {subheading_level} (e.g., '{subheading_markdown} Sub-section Title')."
    )

    llm_prompt = (
        f"Write the markdown content for a new section based on the following user prompt.\n\n"
        f"PROMPT: {prompt}\n\n"
        f"IMPORTANT CONTEXT: {context_text}\n\n"
        f"RULES:\n"
        f"1. Do NOT include the main section heading; only provide the content that goes under it.\n"
        f"2. Ensure any subheadings you create follow the level rule described above.\n"
        f"3. Output only the section content."
    )
    response = await shinkai_llm_prompt_processor({"format": "text", "prompt": llm_prompt})
    msg = response.get("message", "").strip()
    msg = strip_leading_heading(msg)
    return msg

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    md_file_path = inputs.md_file_path
    if not md_file_path or not isinstance(md_file_path, str) or md_file_path.strip() == "":
        output.action_done = "No valid markdown file path provided."
        return output

    if not os.path.exists(md_file_path):
        try:
            with open(md_file_path, "w", encoding="utf-8") as f:
                f.write("")
        except Exception as e:
            output.action_done = f"Failed to create file at {md_file_path}: {str(e)}"
            return output

    try:
        with open(md_file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
    except Exception as e:
        output.action_done = f"Failed to read file {md_file_path}: {str(e)}"
        return output

    prompt = inputs.prompt.strip()

    if len(md_content.strip()) == 0:
        section_heading_line = await propose_section_heading(prompt, context_section=None, add_location="end")
        
        match = re.match(r"^(#+)", section_heading_line)
        parent_level = len(match.group(1)) if match else 2
        
        section_content_val = await propose_section_content(prompt, parent_heading_level=parent_level)
        if section_content_val.strip() == "":
            output.action_done = "No section content generated."
            return output

        new_section_md = f"{section_heading_line.strip()}\n\n{section_content_val.strip()}\n"
        clean_title = strip_heading_from_title(section_heading_line)
        
        try:
            with open(md_file_path, "w", encoding="utf-8") as f:
                f.write(new_section_md)
            output.updated_file_path = md_file_path
            output.action_done = f"Added new section titled '{clean_title}' to the new file."
            output.new_section_details = new_section_md
            return output
        except Exception as e:
            output.action_done = f"Failed to write updated file: {str(e)}"
            return output

    sections = parse_md_sections(md_content)
    flat_with_refs = flatten_sections_for_prompt_with_refs(sections)
    sections_flat = [item[0] for item in flat_with_refs]
    section_refs = [item[1] for item in flat_with_refs]

    relevant_idx = await find_most_relevant_section(sections_flat, prompt)
    add_location = "end"
    add_section_title = None
    context_section = None

    if relevant_idx is not None:
        add_section_title = sections_flat[relevant_idx]["full_title"]
        add_location = extract_insert_location_from_prompt(prompt)
        context_section = {
            "title": sections_flat[relevant_idx]["title"],
            "level": sections_flat[relevant_idx]["level"],
        }
    else:
        add_location = "end"
        add_section_title = None

    section_heading_line = await propose_section_heading(
        prompt,
        context_section=context_section,
        add_location=add_location
    )
    
    match = re.match(r"^(#+)", section_heading_line)
    parent_level = len(match.group(1)) if match else 2

    section_content_val = await propose_section_content(prompt, parent_heading_level=parent_level)
    if section_content_val.strip() == "":
        output.action_done = "No section content generated."
        return output
    
    clean_title = strip_heading_from_title(section_heading_line)
    new_section_md = f"{section_heading_line.strip()}\n\n{section_content_val.strip()}"
    full_text = md_content
    location_desc = ""

    if add_location == "before" and relevant_idx is not None:
        target_sec = section_refs[relevant_idx]
        start_idx, _ = get_section_full_range(target_sec)
        
        pre_content = full_text[:start_idx].rstrip()
        post_content = full_text[start_idx:]
        new_md_content = f"{pre_content}\n\n{new_section_md}\n\n{post_content}"
        
        location_desc = f"before section '{add_section_title}'"

    elif add_location == "after" and relevant_idx is not None:
        target_sec = section_refs[relevant_idx]
        _, end_idx = get_section_full_range(target_sec)
        
        pre_content = full_text[:end_idx].rstrip()
        post_content = full_text[end_idx:]
        new_md_content = f"{pre_content}\n\n{new_section_md}{post_content}"
        
        location_desc = f"after section '{add_section_title}'"
        
    else:
        pre_content = full_text.rstrip()
        new_md_content = f"{pre_content}\n\n{new_section_md}\n"
        location_desc = "at the end of the document"

    try:
        with open(md_file_path, "w", encoding="utf-8") as f:
            f.write(new_md_content)
        output.updated_file_path = md_file_path
        output.action_done = f"Added new section titled '{clean_title}' {location_desc}."
        output.new_section_details = new_section_md
        return output
    except Exception as e:
        output.action_done = f"Failed to write updated file: {str(e)}"
        return output