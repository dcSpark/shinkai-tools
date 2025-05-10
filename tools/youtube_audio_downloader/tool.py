# /// script
# dependencies = [
#   "requests",
#   "yt-dlp",
# ]
# ///

import os
import subprocess
from typing import Optional
from shinkai_local_support import get_home_path

class CONFIG:
    pass

class INPUTS:
    url: str  # The YouTube video URL to download audio from

class OUTPUT:
    success: bool
    file_path: Optional[str] = None
    error_message: Optional[str] = None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    try:
        home_path = await get_home_path()
        os.makedirs(home_path, exist_ok=True)

        # Output template - save to home directory with title and mp3 extension
        output_template = os.path.join(home_path, '%(title)s.%(ext)s')

        # yt-dlp command to extract audio and convert to mp3
        cmd = [
            "yt-dlp",
            "-x",  # extract audio
            "--audio-format", "mp3",  # convert to mp3
            "-o", output_template,
            inputs.url
        ]

        # Run the command and capture output
        process = subprocess.run(cmd, capture_output=True, text=True)

        if process.returncode != 0:
            output.success = False
            output.error_message = process.stderr.strip()
            return output

        # Parse stdout to find the downloaded file path
        file_path = None
        for line in process.stdout.splitlines():
            if "Destination:" in line:
                file_path_candidate = line.split("Destination:")[-1].strip()
                if not os.path.isabs(file_path_candidate):
                    file_path_candidate = os.path.join(home_path, file_path_candidate)
                if os.path.exists(file_path_candidate):
                    file_path = file_path_candidate
                    break

        # If not found in stdout, try to guess the latest mp3 file in home directory
        if not file_path:
            mp3_files = [os.path.join(home_path, f) for f in os.listdir(home_path) if f.lower().endswith('.mp3')]
            if mp3_files:
                file_path = max(mp3_files, key=os.path.getmtime)

        output.success = True
        output.file_path = file_path

    except Exception as e:
        output.success = False
        output.error_message = str(e)

    return output