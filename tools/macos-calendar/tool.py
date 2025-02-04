# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Dict, Any, Optional, List
import subprocess
from datetime import datetime

class CONFIG:
    pass

class INPUTS:
    command: str  # "addEvent", "listToday", or "listWeek"
    title: Optional[str] = None  # for addEvent
    start_date: Optional[str] = None  # "YYYY-MM-DD HH:mm:ss"
    end_date: Optional[str] = None
    calendar_name: Optional[str] = "Calendar"  # default calendar

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

def make_applescript_date(iso_string: str, var_name: str) -> str:
    """Convert ISO date string to AppleScript date setting commands."""
    # Parse "2025-01-01 14:30:00"
    dt = datetime.strptime(iso_string, "%Y-%m-%d %H:%M:%S")
    return f"""
        set {var_name} to current date
        set year of {var_name} to {dt.year}
        set month of {var_name} to {dt.month}
        set day of {var_name} to {dt.day}
        set hours of {var_name} to {dt.hour}
        set minutes of {var_name} to {dt.minute}
        set seconds of {var_name} to {dt.second}
    """

async def get_available_calendars() -> List[str]:
    """Get list of available calendar names."""
    script = """
        tell application "Calendar"
            set calList to ""
            repeat with c in calendars
                set calList to calList & name of c & "|"
            end repeat
            return text 1 thru -2 of calList
        end tell
    """
    result = await run_applescript(script)
    if result.startswith("Error:"):
        return []
    return [name.strip() for name in result.split("|") if name.strip()]

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    script = ""

    if inputs.command == "addEvent":
        if not inputs.title or not inputs.start_date or not inputs.end_date:
            raise ValueError('Missing "title", "start_date", or "end_date" for addEvent')
        
        # Get available calendars
        calendars = await get_available_calendars()
        if not calendars:
            raise ValueError("No calendars available in the system")
        
        print(f"Available calendars: {calendars}")  # Debug logging
        
        # Use specified calendar if it exists, otherwise use first available
        calendar_name = inputs.calendar_name if inputs.calendar_name in calendars else calendars[0]
        print(f"Using calendar: {calendar_name}")  # Debug logging
        
        script = f"""
            tell application "Calendar"
                {make_applescript_date(inputs.start_date, 'theStartDate')}
                {make_applescript_date(inputs.end_date, 'theEndDate')}
                tell calendar "{calendar_name}"
                    make new event with properties {{summary:"{inputs.title}", start date:theStartDate, end date:theEndDate}}
                end tell
            end tell
            return "Event added: {inputs.title}"
        """

    elif inputs.command in ["listToday", "listWeek"]:
        period = "today" if inputs.command == "listToday" else "this week"
        script = f"""
            tell application "Calendar"
                try
                    -- Initialize dates
                    set periodStart to current date
                    set time of periodStart to 0
                    
                    if "{period}" is "today" then
                        set periodEnd to periodStart + 1 * days
                    else
                        -- Calculate week boundaries
                        set weekday_num to weekday of periodStart
                        if weekday_num is not 1 then
                            set periodStart to periodStart - ((weekday_num - 1) * days)
                        end if
                        set periodEnd to periodStart + 7 * days
                    end if
                    
                    set output to ""
                    
                    -- Get events from each calendar
                    repeat with cal in calendars
                        try
                            set calName to name of cal
                            
                            -- Query events
                            tell cal
                                set eventList to (every event whose start date is greater than or equal to periodStart and start date is less than periodEnd)
                                repeat with evt in eventList
                                    set evtSummary to summary of evt
                                    set evtStart to start date of evt
                                    set output to output & "[" & calName & "] " & evtSummary & " at " & (evtStart as string) & linefeed
                                end repeat
                            end tell
                            
                        on error errMsg
                            set output to output & "Error with calendar " & calName & ": " & errMsg & linefeed
                        end try
                    end repeat
                    
                    if output is equal to "" then
                        return "No events {period}"
                    end if
                    return text 1 thru -2 of output
                    
                on error errMsg
                    return "Error: " & errMsg
                end try
            end tell
        """

    else:
        raise ValueError(f"Unknown command: {inputs.command}")

    output.result = await run_applescript(script)
    return output 