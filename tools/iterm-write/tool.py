# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Dict, Any, Optional, List
import subprocess
import os

class CONFIG:
    use_applescript: bool = True  # Whether to use AppleScript to write text to iTerm

class INPUTS:
    command: str  # The command or text to write into the active iTerm session

class OUTPUT:
    lines_output: int  # Number of new lines that appeared in iTerm after the command
    success: bool  # Whether the command was successfully written
    message: str  # Success or error message

def escape_for_applescript(text: str) -> str:
    """Escape special characters for AppleScript."""
    return text.replace('\\', '\\\\').replace('"', '\\"').replace("'", "'\\''")

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.lines_output = 0
    output.success = False
    output.message = ""

    if not inputs.command:
        output.message = "No command specified to write to the iTerm terminal"
        return output

    try:
        # Construct AppleScript command
        script_cmd = f'''
            tell application "iTerm2"
                tell current session of current window
                    write text "{escape_for_applescript(inputs.command)}"
                end tell
            end tell
        '''

        # Execute AppleScript
        process = subprocess.Popen(
            ['/usr/bin/osascript', '-e', script_cmd],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate()

        if process.returncode == 0:
            output.success = True
            output.message = "Command successfully written to iTerm"
            output.lines_output = len(inputs.command.split('\n'))  # Basic estimation
        else:
            output.message = f"Failed to execute AppleScript: {stderr.decode()}"
    except Exception as e:
        output.message = f"Error writing to iTerm: {str(e)}"

    return output 