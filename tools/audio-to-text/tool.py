# /// script
# requires-python = ">=3.10,<3.12"
# dependencies = [
#   "requests",
#   "faster-whisper",
# ]
# ///
import os
from faster_whisper import WhisperModel

class CONFIG:
    # configure model‑size / device via these fields if you like
    model_name: str = "base"      # "base" | "large-v3" | "distil-large"
    device: str = "cpu"           # "cuda" or "cpu"
    compute_type: str = "int8"    # "int8" | "float16" | "int8_float16"

class INPUTS:
    audio_file_path: str

class OUTPUT:
    transcript: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    if not os.path.exists(inputs.audio_file_path):
        raise FileNotFoundError(f"Audio file not found: {inputs.audio_file_path}")

    # initialise faster‑whisper
    model = WhisperModel(
        config.model_name,
        device=config.device,
        compute_type=config.compute_type,
    )

    # transcribe and concatenate segment texts
    segments, _ = model.transcribe(inputs.audio_file_path)
    transcription: str = "".join(seg.text for seg in segments).strip()

    out = OUTPUT()
    out.transcript = transcription
    return out