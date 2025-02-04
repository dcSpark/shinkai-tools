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
    cmd: Optional[str] = None  # for runCommand
    new_window: Optional[bool] = False  # for runCommand

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

async def ensure_iterm_window() -> str:
    """Ensures iTerm is running and has at least one window open."""
    script = """
        tell application "iTerm2"
            activate
            if windows count = 0 then
                create window with default profile
            end if
            return "Window ready"
        end tell
    """
    return await run_applescript(script)

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    
    # First ensure iTerm is running with a window
    await ensure_iterm_window()
    
    script = ""

    if inputs.command == "pasteClipboard":
        script = """
            tell application "iTerm2"
                tell current window
                    tell current session
                        write contents of the clipboard
                    end tell
                end tell
            end tell
            return "Pasted clipboard to iTerm"
        """

    elif inputs.command == "runCommand":
        if not inputs.cmd:
            raise ValueError('Missing "cmd" for runCommand')
            
        # Escape double quotes in the command
        escaped_cmd = inputs.cmd.replace('"', '\\"')
        
        if inputs.new_window:
            script = f'''
                tell application "iTerm2"
                    create window with default profile
                    tell current window
                        tell current session
                            write text "{escaped_cmd}"
                        end tell
                    end tell
                    return "Ran '{escaped_cmd}' in new iTerm window"
                end tell
            '''
        else:
            script = f'''
                tell application "iTerm2"
                    tell current window
                        tell current session
                            write text "{escaped_cmd}"
                        end tell
                    end tell
                    return "Ran '{escaped_cmd}' in existing iTerm window"
                end tell
            '''

    else:
        raise ValueError(f"Unknown command: {inputs.command}")

    output.result = await run_applescript(script)
    return output 