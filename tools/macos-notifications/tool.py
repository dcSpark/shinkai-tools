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
    title: Optional[str] = None  # for sendNotification
    message: Optional[str] = None  # for sendNotification
    sound: Optional[bool] = True  # for sendNotification

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
    
    if inputs.command == "toggleDoNotDisturb":
        script = """
            set toggleResult to "Error: Could not toggle Do Not Disturb via System Settings."
            
            -- Open System Settings directly to Focus panel
            do shell script "open 'x-apple.systempreferences:com.apple.Focus-Settings'"
            delay 1

            tell application "System Events"
                tell process "System Settings"
                    -- Wait until the main window is detected
                    repeat until exists window 1
                        delay 0.3
                    end repeat
                    
                    -- Make sure System Settings is frontmost
                    set frontmost to true
                    delay 1

                    -- Try to find and click the Do Not Disturb row
                    try
                        -- First try to find it in a list/table
                        set dndRow to first row of list 1 of window 1 whose name contains "Do Not Disturb"
                        click dndRow
                        delay 0.5
                        
                        -- Try to find and click the toggle
                        try
                            set toggleSwitch to first checkbox of window 1
                            click toggleSwitch
                            set toggleResult to "Toggled Do Not Disturb"
                        on error
                            -- If we can't find a checkbox, try clicking the row again
                            click dndRow
                            set toggleResult to "Toggled Do Not Disturb"
                        end try
                    on error
                        try
                            -- Try finding it as a table row
                            set dndRow to first row of table 1 of window 1 whose name contains "Do Not Disturb"
                            click dndRow
                            delay 0.5
                            
                            -- Try to find and click the toggle
                            try
                                set toggleSwitch to first checkbox of window 1
                                click toggleSwitch
                                set toggleResult to "Toggled Do Not Disturb"
                            on error
                                -- If we can't find a checkbox, try clicking the row again
                                click dndRow
                                set toggleResult to "Toggled Do Not Disturb"
                            end try
                        on error errMsg
                            set toggleResult to "Error finding Do Not Disturb: " & errMsg
                        end try
                    end try
                end tell
            end tell

            return toggleResult
        """
        output.result = await run_applescript(script)
        return output

    elif inputs.command == "sendNotification":
        if not inputs.title or not inputs.message:
            raise ValueError('Missing "title" or "message" for sendNotification')
        sound_option = 'sound name "default"' if inputs.sound else ''
        script = f"""
            display notification "{inputs.message}" with title "{inputs.title}" {sound_option}
            return "Notification sent"
        """
        output.result = await run_applescript(script)
        return output

    else:
        raise ValueError(f"Unknown command: {inputs.command}")

    return output 