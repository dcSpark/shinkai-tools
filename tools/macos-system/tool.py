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
    level: Optional[int] = None  # for setVolume
    app_name: Optional[str] = None  # for launchApp/quitApp
    force: Optional[bool] = False  # for quitApp

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

    if inputs.command == "setVolume":
        if inputs.level is None:
            raise ValueError('Missing "level" for setVolume')
        # Convert 0..100 → 0..7
        volume_int = round((inputs.level / 100) * 7)
        script = f'set volume {volume_int}\nreturn "Volume set to {inputs.level}%"'

    elif inputs.command == "getFrontmostApp":
        script = """
            tell application "System Events"
                set frontApp to name of first process whose frontmost is true
            end tell
            return frontApp
        """

    elif inputs.command == "launchApp":
        if not inputs.app_name:
            raise ValueError('Missing "app_name" for launchApp')
        script = f"""
            try
                tell application "{inputs.app_name}"
                    activate
                end tell
                return "Launched {inputs.app_name}"
            on error errMsg
                return "Failed to launch {inputs.app_name}: " & errMsg
            end try
        """

    elif inputs.command == "quitApp":
        if not inputs.app_name:
            raise ValueError('Missing "app_name" for quitApp')
        quit_cmd = "quit saving no" if inputs.force else "quit"
        script = f"""
            try
                tell application "{inputs.app_name}"
                    {quit_cmd}
                end tell
                return "Quit {inputs.app_name}"
            on error errMsg
                return "Failed to quit {inputs.app_name}: " & errMsg
            end try
        """

    elif inputs.command == "toggleDarkMode":
        script = """
            tell application "System Events"
                tell appearance preferences
                    set dark mode to not dark mode
                    return "Dark mode is now " & (dark mode as text)
                end tell
            end tell
        """

    elif inputs.command == "getBatteryStatus":
        script = """
            try
                set powerSource to do shell script "pmset -g batt"
                return powerSource
            on error errMsg
                return "Failed to get battery status: " & errMsg
            end try
        """

    else:
        raise ValueError(f"Unknown command: {inputs.command}")

    output.result = await run_applescript(script)
    return output 