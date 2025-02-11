# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Dict, Any, Optional, List
import subprocess
import os

# Map of control characters to their ASCII values
CONTROL_CHARS = {
    'C': 3,   # Ctrl-C (SIGINT)
    'D': 4,   # Ctrl-D (EOF)
    'Z': 26,  # Ctrl-Z (SIGTSTP)
    'L': 12,  # Ctrl-L (Clear screen)
    'U': 21,  # Ctrl-U (Clear line)
    'R': 18,  # Ctrl-R (Search history)
}

class CONFIG:
    pass  # No specific configuration needed for control characters

class INPUTS:
    letter: str  # The single letter to send as Ctrl-letter (e.g. 'C', 'D', 'Z')

class OUTPUT:
    success: bool  # Whether the control character was successfully sent
    message: str  # Result of the control operation

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.success = False
    output.message = ""

    if not inputs.letter or len(inputs.letter) != 1:
        output.message = "You must provide a single letter to send as a control character"
        return output

    control_letter = inputs.letter.upper()
    if control_letter not in CONTROL_CHARS:
        output.message = f"Control-{control_letter} is not supported. Supported letters: {', '.join(CONTROL_CHARS.keys())}"
        return output

    try:
        # Construct AppleScript command to send control character
        ascii_value = CONTROL_CHARS[control_letter]
        script_cmd = f'''
            tell application "iTerm2"
                tell current session of current window
                    write text (ASCII character {ascii_value})
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
            output.message = f"Successfully sent Control-{control_letter} (ASCII {ascii_value})"
        else:
            output.message = f"Failed to send Control-{control_letter}: {stderr.decode()}"
    except Exception as e:
        output.message = f"Error sending control character: {str(e)}"

    return output 