# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
import os
import re
import pathlib
from shinkai_local_tools import (
    audio_llm_processor,
    shinkai_llm_prompt_processor,
)
from shinkai_local_support import get_home_path

class CONFIG:
    """
    Configuration for the SRT generator tool.
    """
    pass

class INPUTS:
    file_path: str # Full local path to the audio or video file
    output_filename: Optional[str] = None # Optional custom filename for the .srt output
    show_content: bool = True # Whether to return the content of the generated SRT file (default: True)
    additional_instructions: Optional[str] = None # Optional instructions to guide the subtitle generation (e.g., "Use British English spelling", "Translate to Spanish")

class OUTPUT:
    srt_file_path: str # Path where the .srt file was saved
    srt_content: Optional[str] = None # Content of the .srt file if requested

# --- Helper Functions ---

def sanitize_filename(filename: str) -> str:
    """
    Sanitizes a filename to ensure it is safe for file system operations.
    1. Removes any directory path components (e.g., ../, /var/) using os.path.basename.
    2. Replaces any non-alphanumeric characters (except . and -) with underscores.
    This effectively prevents directory traversal attacks and handles invalid characters.
    """
    # Remove directory paths if present, just keep the name. 
    # This prevents "folder/file" or "../file" from traversing directories.
    name = os.path.basename(filename)
    
    # Replace non-alphanumeric/dot/dash with underscore.
    # This removes slashes, backslashes, colons, etc.
    clean_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', name)
    
    # Ensure it's not empty
    if not clean_name:
        clean_name = "output_subs"
        
    return clean_name

def strip_markdown(text: str) -> str:
    """
    Removes markdown code blocks if the LLM wraps the output in them.
    Example: ```srt ... ``` -> ...
    """
    # Regex to match ```srt ... ``` or just ``` ... ```
    pattern = r"^```(?:\w+)?\s*\n(.*?)\n```$"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()

def parse_srt_timestamp(timestamp: str) -> int:
    """
    Parses a timestamp string 'HH:MM:SS,mmm' into milliseconds.
    Returns -1 if format is invalid.
    """
    # Regex to capture parts: 00:00:01,451
    match = re.match(r'(\d{2}):(\d{2}):(\d{2}),(\d{3})', timestamp)
    if not match:
        return -1
    
    hours, minutes, seconds, milliseconds = map(int, match.groups())
    
    total_ms = (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + milliseconds
    return total_ms

def validate_srt_format(content: str) -> tuple[bool, str]:
    """
    Deterministic check for SRT format.
    Checks structure and chronological timing.
    Returns (is_valid, error_message).
    """
    if not content:
        return False, "Content is empty."

    # Normalize newlines
    content = content.replace('\r\n', '\n')
    
    # Split into blocks by double newlines
    blocks = re.split(r'\n\n+', content.strip())

    if not blocks:
        return False, "No subtitle blocks found."

    # Regex for the timestamp line: 00:00:01,451 --> 00:00:03,812
    # Strict format: 2 digits : 2 digits : 2 digits , 3 digits --> ...
    time_line_pattern = re.compile(r'^(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})$')
    
    previous_end_ms = -1

    for i, block in enumerate(blocks):
        lines = block.strip().split('\n')
        # A valid block needs at least: Index, Time, Text
        if len(lines) < 3:
            return False, f"Block {i+1} is malformed (too few lines). Content: '{block}'"

        # 1. Check Index
        if not lines[0].isdigit():
            return False, f"Block {i+1}: First line must be a numeric counter. Found: '{lines[0]}'"
        
        # 2. Check Timestamp format
        time_match = time_line_pattern.match(lines[1].strip())
        if not time_match:
            return False, f"Block {i+1}: Second line must match timestamp format 'HH:MM:SS,mmm --> HH:MM:SS,mmm'. Found: '{lines[1]}'"
        
        start_str, end_str = time_match.groups()
        start_ms = parse_srt_timestamp(start_str)
        end_ms = parse_srt_timestamp(end_str)

        # 3. Check Logic: End > Start
        if end_ms <= start_ms:
             return False, f"Block {i+1}: End time ({end_str}) must be greater than start time ({start_str})."

        # 4. Check Logic: Chronological order (Start >= Previous End)
        # We allow start == previous end (immediate succession)
        if i > 0 and start_ms < previous_end_ms:
             return False, f"Block {i+1}: Start time ({start_str}) cannot be earlier than the previous block's end time (approx {previous_end_ms}ms)."

        previous_end_ms = end_ms

        # 5. Text exists
        if not lines[2].strip():
             return False, f"Block {i+1}: Subtitle text is missing."

    return True, "Valid"

# --- Main Logic ---

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    """
    Process an audio or video file to generate an SRT subtitle file.
    Validates format and uses LLM to fix if necessary.
    """
    
    # 1. Validate Input File
    file_path = inputs.file_path
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Input file not found at: {file_path}")

    path_obj = pathlib.Path(file_path)

    # 2. Construct Prompt
    srt_prompt_template = """
You are an expert transcriber. Create a subtitle file in .srt format for the provided media.
Do not include any introduction, explanation, or markdown formatting (like ```). Output ONLY the raw .srt content.

STRICTLY ADHERE to this format example:

1
00:00:01,451 --> 00:00:03,812
You can use Shinkai to easily find new

2
00:00:03,812 --> 00:00:04,693
e-books to read.

3
00:00:05,871 --> 00:00:07,992
With an AI librarian agent, you'll get

Rules:
1. Sequential numeric counter starting at 1.
2. Time format: HH:MM:SS,mmm --> HH:MM:SS,mmm (comma for milliseconds, NO dots).
3. Text content on following lines.
4. Empty line between blocks.
5. Each block must a few seconds long, from 1 to 10 seconds maximum.
6. There can be time gaps between blocks. When they are silences or pauses, a block can start way later that the end of the precedent block.
7. Each block must have between 1 and 10 words max so that it fits on screen.
8. The start time of a block MUST NOT be before the end time of the preceding block.
9. Generally, the timings must match when words appear in the video, with max a few seconds gap.
"""

    if inputs.additional_instructions:
        srt_prompt_template += f"\n\nAdditional User Instructions:\n{inputs.additional_instructions}\n"

    # 3. Call Processor (Always use audio_llm_processor for both audio and video)
    # The audio_llm_processor handles video files by extracting/processing the audio track.
    response = await audio_llm_processor({
        "audio_path": file_path,
        "prompt": srt_prompt_template
    })
    initial_content = response.get("message", "")

    # 4. Clean and Validate
    current_content = strip_markdown(initial_content)
    is_valid, error_msg = validate_srt_format(current_content)
    
    # 5. Correction Loop (if invalid)
    max_retries = 2
    retry_count = 0

    while not is_valid and retry_count < max_retries:
        
        fix_prompt = f"""
The following text was meant to be a valid .srt file but failed validation.
Error: {error_msg}

Required Format Example:
1
00:00:01,451 --> 00:00:03,812
Text here

2
00:00:03,812 --> 00:00:05,000
Next text here

Please fix the content below and return ONLY the raw .srt text. No markdown.
Ensure that timestamps are chronological (Start time of block N >= End time of block N-1).

Current Content to fix:
{current_content}
"""
        # Use the general prompt processor to fix text structure
        fix_response = await shinkai_llm_prompt_processor({
            "format": "text",
            "prompt": fix_prompt
        })
        
        current_content = strip_markdown(fix_response.get("message", ""))
        is_valid, error_msg = validate_srt_format(current_content)
        retry_count += 1

    # 6. Save File
    home_path = await get_home_path()
    
    if inputs.output_filename:
        # User provided filename: Sanitize strictly to avoid folder traversal
        sanitized_name = sanitize_filename(inputs.output_filename)
        if not sanitized_name.lower().endswith('.srt'):
            sanitized_name += ".srt"
    else:
        # Default: original filename + .srt
        original_name = path_obj.stem # filename without extension
        sanitized_name = sanitize_filename(original_name) + ".srt"

    save_path = os.path.join(home_path, sanitized_name)

    try:
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(current_content)
    except Exception as e:
        raise IOError(f"Failed to write SRT file to {save_path}: {str(e)}")

    # 7. Prepare Output
    output = OUTPUT()
    output.srt_file_path = save_path
    if inputs.show_content:
        output.srt_content = current_content
    else:
        output.srt_content = None

    return output