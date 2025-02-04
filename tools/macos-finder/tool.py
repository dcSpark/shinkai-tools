# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Dict, Any, Optional, List
import subprocess
import os
from dataclasses import dataclass

@dataclass
class CONFIG:
    pass

@dataclass
class INPUTS:
    command: str
    query: Optional[str] = None  # For searchFiles
    location: Optional[str] = None  # For searchFiles
    file_path: Optional[str] = None  # For quickLookFile

@dataclass
class OUTPUT:
    result: str = ""

async def run_applescript(script: str) -> str:
    """Helper function to run AppleScript and return its output."""
    try:
        result = subprocess.run(['osascript', '-e', script], 
                              capture_output=True, 
                              text=True, 
                              check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        return f"Error: {e.stderr.strip()}"

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    script = ""

    # Validate inputs first
    if inputs.command == "quickLookFile":
        if not inputs.file_path:
            raise ValueError('Missing "file_path" for quickLookFile')
    elif inputs.command == "searchFiles":
        if not inputs.query:
            raise ValueError('Missing "query" for searchFiles')

    if inputs.command == "getSelectedFiles":
        script = """
            tell application "Finder"
                try
                    set selectedItems to selection
                    if selectedItems is {} then
                        return "No items selected"
                    end if
                    set itemPaths to ""
                    repeat with theItem in selectedItems
                        set itemPaths to itemPaths & (POSIX path of (theItem as alias)) & linefeed
                    end repeat
                    return itemPaths
                on error errMsg
                    return "Failed to get selected files: " & errMsg
                end try
            end tell
        """

    elif inputs.command == "searchFiles":
        search_location = inputs.location or "~"
        # Expand the path before passing it to AppleScript
        expanded_path = os.path.expanduser(search_location)
        script = f"""
            tell application "Finder"
                try
                    set searchPath to POSIX file "{expanded_path}"
                    set theFiles to every file of (searchPath as alias) whose name contains "{inputs.query}"
                    set resultList to ""
                    repeat with aFile in theFiles
                        set resultList to resultList & (POSIX path of (aFile as alias)) & return
                    end repeat
                    if resultList is "" then
                        return "No files found matching '{inputs.query}' in '{search_location}'"
                    end if
                    return resultList
                on error errMsg
                    return "Failed to search files: " & errMsg
                end try
            end tell
        """

    elif inputs.command == "quickLookFile":
        # We can safely use file_path here since we validated it above
        abs_path = os.path.abspath(os.path.expanduser(inputs.file_path))
        script = f"""
            tell application "Finder"
                try
                    set targetFile to (POSIX file "{abs_path}") as alias
                    select targetFile
                    activate
                    tell application "System Events"
                        keystroke space
                    end tell
                    return "Quick Look preview opened for {inputs.file_path}"
                on error errMsg
                    return "Failed to open Quick Look: " & errMsg
                end try
            end tell
        """

    else:
        raise ValueError(f"Unknown command: {inputs.command}")

    output.result = await run_applescript(script)
    return output 