# /// script
# dependencies = [
#   "kokoro-onnx",
#   "soundfile",
#   "pathlib",
#   "requests",
#   "onnxruntime",
#   "numpy"
# ]
# ///

from kokoro_onnx import config, Kokoro
from pathlib import Path
import soundfile as sf
from typing import Optional, Dict, Any, List
import os
import requests
import onnxruntime as ort
import time
import numpy as np
from shinkai_local_support import get_home_path

# Configure Kokoro settings
config.MAX_PHONEME_LENGTH = 128

# URLs from the official kokoro-onnx repository
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/v1.0/kokoro-v1_0.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/v1.0/voices.bin"

def download_file(url: str, local_path: str) -> None:
    print(f"Downloading {url}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    total_size = int(response.headers.get('content-length', 0))
    block_size = 8192
    downloaded = 0
    start_time = time.time()
    
    with open(local_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=block_size):
            downloaded += len(chunk)
            f.write(chunk)
            # Show download progress
            if total_size > 0:
                progress = (downloaded / total_size) * 100
                elapsed = time.time() - start_time
                speed = downloaded / (1024 * 1024 * elapsed) if elapsed > 0 else 0  # MB/s
                print(f"Download progress: {progress:.1f}% ({speed:.1f} MB/s)", end='\r')
    print("\nDownload complete!")

class CONFIG:
    model_path: str = "kokoro-v1_0.onnx"
    voices_path: str = "voices.bin"
    providers: Optional[List[str]] = None  # ONNX providers (e.g. ["CPUExecutionProvider", "CUDAExecutionProvider"])

class INPUTS:
    text: str  # The text to convert to audio
    voice: str = "af_sky"  # Default voice from: af, af_bella, af_nicole, af_sarah, af_sky, am_adam, am_michael, bf_emma, bf_isabella, bm_george, bm_lewis
    language: str = "en-gb"  # Currently only English is fully supported
    speed: float = 1.0  # Default speed
    output_format: str = "wav"  # Default output format

class OUTPUT:
    output_file: str
    duration: float
    sample_rate: int
    chars_per_second: float

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    # Validate input text
    if not p.text or p.text.strip() == "":
        raise ValueError("Text input cannot be empty")

    # Get home path for file operations
    home_path = await get_home_path()
    model_path = os.path.join(home_path, c.model_path)
    voices_path = os.path.join(home_path, c.voices_path)
    
    # Download model and voices if not present
    if not Path(model_path).exists():
        print(f"Downloading model from {MODEL_URL}...")
        try:
            download_file(MODEL_URL, model_path)
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Failed to download model: {str(e)}")
        
    if not Path(voices_path).exists():
        print(f"Downloading voices from {VOICES_URL}...")
        try:
            download_file(VOICES_URL, voices_path)
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Failed to download voices: {str(e)}")

    # Initialize Kokoro
    if not (Path(model_path).exists() and Path(voices_path).exists()):
        raise ValueError("Model and voices files must be present in the specified paths")
    
    kokoro = Kokoro(model_path, voices_path)
    
    # Set ONNX providers if specified
    if c.providers:
        available_providers = ort.get_available_providers()
        invalid_providers = [p for p in c.providers if p not in available_providers]
        if invalid_providers:
            raise ValueError(f"Invalid ONNX providers: {', '.join(invalid_providers)}. Available providers: {', '.join(available_providers)}")
        kokoro.sess.set_providers(c.providers)
        print(f"Using ONNX providers: {', '.join(c.providers)}")
    
    # Generate audio
    start_time = time.time()
    samples, sample_rate = kokoro.create(
        text=p.text,
        voice=p.voice,
        speed=p.speed,
        lang=p.language
    )
    end_time = time.time()
    
    # Create output filename and save audio
    output_file = os.path.join(home_path, f"output.{p.output_format}")
    sf.write(output_file, samples, sample_rate)
    
    # Calculate metrics
    duration = len(samples) / sample_rate
    chars_per_second = len(p.text) / (end_time - start_time)
    
    print(f"Generated {len(p.text):,} characters in {end_time - start_time:.2f} seconds")
    print(f"Processing speed: {chars_per_second:.0f} characters per second")
    print(f"Audio duration: {duration:.2f} seconds")
    print(f"Output saved to: {output_file}")
    
    # Prepare output
    output = OUTPUT()
    output.output_file = output_file
    output.duration = duration
    output.sample_rate = sample_rate
    output.chars_per_second = chars_per_second
    
    return output  