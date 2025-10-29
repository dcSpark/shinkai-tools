# /// script
# dependencies = [
#   "requests",
#   "yt-dlp",
# ]
# ///

from typing import Optional
from datetime import datetime

class CONFIG:
    pass

class INPUTS:
    url: str
    filename: Optional[str] = None

class OUTPUT:
    audio_path: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    from shinkai_local_support import get_home_path
    home_path = await get_home_path()
    import os
    import yt_dlp

    # Generate base filename
    if inputs.filename:
        base_filename = inputs.filename
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_filename = f"audio_file_{timestamp}"

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{home_path}/{base_filename}.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([inputs.url])

    audio_path = f"{home_path}/{base_filename}.mp3"
    if os.path.exists(audio_path):
        output = OUTPUT()
        output.audio_path = audio_path
        return output
    else:
        raise ValueError("Failed to download audio")