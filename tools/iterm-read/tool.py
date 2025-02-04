# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Dict, Any, Optional, List
import subprocess
import os

class CONFIG:
    pass  # No specific configuration needed for reading

class INPUTS:
    lines_of_output: int = 25  # Number of lines of terminal output to fetch

class OUTPUT:
    terminal_output: str  # The last N lines of terminal output
    success: bool  # Whether the read operation was successful
    message: str  # Success or error message

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.terminal_output = ""
    output.success = False
    output.message = ""

    try:
        # Construct AppleScript command to get terminal content
        script_cmd = f'''
            tell application "iTerm2"
                tell current session of current window
                    get contents
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
            # Get the terminal output and split into lines
            all_lines = stdout.decode().split('\n')
            
            # Get the last N lines based on input parameter
            requested_lines = min(inputs.lines_of_output, len(all_lines))
            output.terminal_output = '\n'.join(all_lines[-requested_lines:])
            
            output.success = True
            output.message = f"Successfully read {requested_lines} lines from iTerm"
        else:
            output.message = f"Failed to read from iTerm: {stderr.decode()}"
    except Exception as e:
        output.message = f"Error reading from iTerm: {str(e)}"

    return output 