# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Dict, Any, Optional, List
import subprocess

class CONFIG:
    pass

class INPUTS:
    command: str
    content: Optional[str] = None  # for setClipboard
    content_type: Optional[str] = "text"  # for getClipboard

class OUTPUT:
    result: str

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

    if inputs.command == "getClipboard":
        if inputs.content_type == "filePaths":
            script = """
                tell application "System Events"
                    try
                        set theClipboard to the clipboard
                        if theClipboard starts with "file://" then
                            set AppleScript's text item delimiters to linefeed
                            set filePaths to {}
                            repeat with aLine in paragraphs of (the clipboard as string)
                                if aLine starts with "file://" then
                                    set end of filePaths to (POSIX path of (aLine as alias))
                                end if
                            end repeat
                            return filePaths as string
                        else
                            return "No file paths in clipboard"
                        end if
                    on error errMsg
                        return "Failed to get file paths: " & errMsg
                    end try
                end tell
            """
        else:
            script = """
                tell application "System Events"
                    try
                        return (the clipboard as text)
                    on error errMsg
                        return "Failed to get clipboard: " & errMsg
                    end try
                end tell
            """

    elif inputs.command == "setClipboard":
        if not inputs.content:
            raise ValueError('Missing "content" for setClipboard')
        script = f"""
            try
                set the clipboard to "{inputs.content}"
                return "Clipboard set successfully"
            on error errMsg
                return "Failed to set clipboard: " & errMsg
            end try
        """

    elif inputs.command == "clearClipboard":
        script = """
            try
                set the clipboard to ""
                return "Clipboard cleared"
            on error errMsg
                return "Failed to clear clipboard: " & errMsg
            end try
        """

    else:
        raise ValueError(f"Unknown command: {inputs.command}")

    output.result = await run_applescript(script)
    return output 