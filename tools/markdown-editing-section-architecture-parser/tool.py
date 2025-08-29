# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Optional, List
import os
import re

class CONFIG:
    pass

class INPUTS:
    md_file_path: str

class OUTPUT:
    file_path: Optional[str] = None
    section_titles: Optional[List[str]] = None
    section_titles_reading_instructions: Optional[str] = None

INSTRUCTIONS = (
    "When reading the section titles, avoid adding numbers to them. "
    "Read stricly only the original list as it is. This will avoid doubling indexing numbers if the section titles already contain numbers."
)

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    md_file_path = inputs.md_file_path
    section_titles: List[str] = []

    if not md_file_path or not isinstance(md_file_path, str) or not os.path.exists(md_file_path):
        output.file_path = md_file_path
        output.section_titles = section_titles
        output.section_titles_reading_instructions = INSTRUCTIONS
        return output

    try:
        with open(md_file_path, "r", encoding="utf-8") as f:
            for line in f:
                m = re.match(r'^(#{1,6})\s+(.*)$', line)
                if m:
                    title = m.group(2).strip()
                    section_titles.append(title)
    except Exception:
        section_titles = []

    output.file_path = md_file_path
    output.section_titles = section_titles
    output.section_titles_reading_instructions = INSTRUCTIONS
    return output