# /// script
# dependencies = [
#   "requests",
#   "youtube-transcript-api",
# ]
# ///

"""
Thinking Process:
1. Extract the YouTube video ID from the provided URL. If the URL includes "v=", split accordingly. Also handle "youtu.be" style URLs.
2. Use the youtube_transcript_api library to fetch the transcript. The fetch method takes a video ID and an optional list of languages.
3. Since the run function is asynchronous and youtube_transcript_api is synchronous, utilize asyncio.to_thread to run the blocking call.
4. Handle potential exceptions such as an invalid URL, transcripts being disabled, transcript not found, or video unavailable.
5. Return a structured OUTPUT containing the transcript snippets (each with text, start, and duration).
"""

from typing import List, Optional
import asyncio
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable

class CONFIG:
    pass

class INPUTS:
    url: str
    lang: Optional[str] = None

class OUTPUT:
    transcript: List[dict]

def extract_video_id(url: str) -> str:
    # Try to extract video id from the standard url parameter 'v'
    if "v=" in url:
        # Remove any additional parameters after video id
        video_id = url.split("v=")[1].split("&")[0]
        if video_id:
            return video_id
    # Handle shortened URLs like https://youtu.be/<video_id>
    if "youtu.be/" in url:
        video_id = url.split("youtu.be/")[1].split("?")[0]
        if video_id:
            return video_id
    raise Exception("Invalid YouTube URL, unable to extract video ID.")

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    video_url = inputs.url
    language = inputs.lang if inputs.lang is not None else "en"
    
    try:
        video_id = extract_video_id(video_url)
    except Exception as e:
        raise Exception(f"Error extracting video ID: {e}")
    
    try:
        # Run the synchronous transcript fetch in a separate thread
        transcript = await asyncio.to_thread(
            YouTubeTranscriptApi().fetch, video_id, [language]
        )
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
        raise Exception(f"Error fetching transcript: {e}")
    except Exception as e:
        raise Exception(f"Unhandled error: {e}")
    
    output = OUTPUT()
    output.transcript = transcript
    return output