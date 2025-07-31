# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Optional, Literal
import os
import time
import requests
from shinkai_local_support import get_home_path

class CONFIG:
    api_key: str
    default_model: str = "gpt-4o-mini-tts"
    default_audio_format: str = "mp3"
    default_speed: float = 1.0

class INPUTS:
    """
    Inputs for TTS generation.

    Attributes:
        text (str): The text to convert to speech.
        voice (Optional[Literal[...]]): The voice to use for speech synthesis.
            Possible voices:
            - alloy
            - ash
            - ballad
            - coral
            - echo
            - fable
            - nova
            - onyx (default)
            - sage
            - shimmer
        instructions (Optional[str]): Optional instructions to control speech aspects such as:
            accent, emotional range, intonation, impressions, speed, tone, whispering, etc.
        model (str): One of available TTS models: tts-1, tts-1-hd or gpt-4o-mini-tts.
            Defaults to config default_model or "gpt-4o-mini-tts"
        audio_format (Optional[str]): The audio format to output.
            Supported: mp3, opus, aac, flac, wav, pcm.
            Defaults to config default_audio_format or "mp3".
        speed (Optional[float]): Speed of generated audio, between 0.25 and 4.0.
            Default is config default_speed or 1.0.
    """
    text: str
    voice: Optional[Literal[
        "alloy", "ash", "ballad", "coral", "echo", "fable",
        "nova", "onyx", "sage", "shimmer"
    ]] = None
    instructions: Optional[str] = None
    model: Optional[str] = None
    audio_format: Optional[str] = None
    speed: Optional[float] = None

class OUTPUT:
    """
    Output of the TTS process.

    Attributes:
        audio_file_path (str): The file path where the generated speech audio is saved.
    """
    audio_file_path: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    """
    Generate speech audio from text using OpenAI TTS API.

    Args:
        config (CONFIG): Configuration including API key, and default parameters.
        inputs (INPUTS): Input text, voice, optional instructions, model, audio format and speed.

    Returns:
        OUTPUT: Contains path to the generated audio file.
    """
    output = OUTPUT()

    # Resolve parameters with fallbacks to config defaults
    model = inputs.model if inputs.model else getattr(config, "default_model", "gpt-4o-mini-tts")
    audio_format = inputs.audio_format if inputs.audio_format else getattr(config, "default_audio_format", "mp3")
    speed = inputs.speed if inputs.speed is not None else getattr(config, "default_speed", 1.0)

    # Validate model
    allowed_models = {"tts-1", "tts-1-hd", "gpt-4o-mini-tts"}
    if model not in allowed_models:
        raise ValueError(f"Invalid model '{model}', must be one of {allowed_models}")

    # Validate audio_format
    allowed_formats = {"mp3", "opus", "aac", "flac", "wav", "pcm"}
    if audio_format not in allowed_formats:
        raise ValueError(f"Invalid audio_format '{audio_format}', must be one of {allowed_formats}")

    # Validate speed range
    if not (0.25 <= speed <= 4.0):
        raise ValueError("speed must be between 0.25 and 4.0")

    voice = inputs.voice if inputs.voice else "onyx"
    text = inputs.text
    instructions = inputs.instructions

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {config.api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": model,            # "tts-1", "tts-1-hd", or "gpt-4o-mini-tts"
        "voice": voice,            # voice selection
        "input": text,             # text to synthesize
        "format": audio_format,    # audio output format
        "speed": speed,            # speed multiplier (0.25 to 4.0)
    }
    if instructions:
        data["instructions"] = instructions

    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    audio_data = response.content

    home_dir = await get_home_path()
    timestamp = int(time.time() * 1000)
    filename = f"tts_output_{timestamp}.{audio_format}"
    filepath = os.path.join(home_dir, filename)

    with open(filepath, "wb") as f:
        f.write(audio_data)

    output.audio_file_path = filepath
    return output