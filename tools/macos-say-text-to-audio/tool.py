# /// script
# dependencies = [
#   "requests"
# ]
# ///

import subprocess
import sys
from typing import Dict, Any, Optional, List

class CONFIG:
    """
    No configurations needed for this tool by default.
    But you could expand if you need environment checks, etc.
    """
    pass

class INPUTS:
    text: str  # The text to speak
    voice: str = "Alex"  # A valid macOS voice, e.g. "Alex", "Daniel", "Victoria", etc.
    rate: int = 175      # Words per minute. Mac `say` defaults around 175
    background: bool = False

class OUTPUT:
    success: bool
    message: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    """
    Speaks out the given text on macOS using the 'say' command.
    """
    # Validate platform
    if sys.platform != 'darwin':
        raise RuntimeError("This tool only works on macOS systems")

    # Validate inputs
    text = p.text.strip()
    if not text:
        raise ValueError("No text provided to speak.")
    if p.rate < 1 or p.rate > 500:
        raise ValueError("Rate must be between 1 and 500 words per minute.")

    # Build shell command
    # Example: say -v "Alex" -r 175 "Hello world"
    # If background is True, add an ampersand at the end (shell background).
    voice_arg = f'-v "{p.voice}"'
    rate_arg = f'-r {p.rate}'
    quoted_text = text.replace('"', '\\"')  # Escape double quotes
    cmd = f'say {voice_arg} {rate_arg} "{quoted_text}"'
    if p.background:
        cmd += " &"

    # Run the command
    try:
        subprocess.run(cmd, shell=True, check=True)
        success = True
        message = f"Spoke text with voice={p.voice}, rate={p.rate}, background={p.background}"
    except subprocess.CalledProcessError as e:
        success = False
        message = f"Failed to speak text: {str(e)}"

    output = OUTPUT()
    output.success = success
    output.message = message
    return output 