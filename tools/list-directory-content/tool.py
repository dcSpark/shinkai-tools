# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import List, Optional
from pathlib import Path

class CONFIG:
    pass

class INPUTS:
    folder_path: str  # Full or relative path to the directory (e.g., '/home/user/docs' or 'docs'). Required, no default.
    include_subfolders: bool = False  # If True, also list subfolders (direct children only); default False (files only).

class OUTPUT:
    files: List[str]  # Sorted list of full absolute paths to files (not directories/subfolders).
    subfolders: List[str]  # Sorted list of full absolute paths to direct subfolders (empty list if include_subfolders=False).
    error: Optional[str] = None  # Error message if validation or listing fails (e.g., path invalid, permissions).

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.files = []
    output.subfolders = []
    output.error = None

    # Input validation
    if not inputs.folder_path or not inputs.folder_path.strip():
        output.error = "folder_path is empty or invalid."
        return output

    path = Path(inputs.folder_path).absolute()
    if not path.exists():
        output.error = f"Path does not exist: {path}"
        return output
    if not path.is_dir():
        output.error = f"Path is not a directory: {path}"
        return output

    try:
        entries = list(path.iterdir())
        output.files = sorted(str(p.absolute()) for p in entries if p.is_file())
        if inputs.include_subfolders:
            output.subfolders = sorted(str(p.absolute()) for p in entries if p.is_dir())
    except PermissionError:
        output.error = f"Permission denied accessing directory: {path}"
    except Exception as e:
        output.error = f"Error listing directory '{path}': {str(e)}"

    return output