# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
import os
from shinkai_local_support import get_home_path

class CONFIG:
    pass

class INPUTS:
    text_content: str

class OUTPUT:
    message: str
    md_filepath: Optional[str]

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    try:
        home_dir = await get_home_path()
        if not home_dir or not os.path.isdir(home_dir):
            output.message = "Error: Home directory path is invalid or does not exist."
            output.md_filepath = None
            return output

        filename = "exported_content.md"
        md_path = os.path.join(home_dir, filename)

        # If file exists, add suffix to avoid overwriting
        counter = 1
        base_name = "exported_content"
        ext = ".md"
        while os.path.exists(md_path):
            filename = f"{base_name}_{counter}{ext}"
            md_path = os.path.join(home_dir, filename)
            counter += 1

        with open(md_path, "w", encoding="utf-8") as f:
            f.write(inputs.text_content)

        output.message = f"Markdown file saved successfully at: {md_path}"
        output.md_filepath = md_path
    except Exception as e:
        output.message = f"Error saving markdown file: {str(e)}"
        output.md_filepath = None

    return output