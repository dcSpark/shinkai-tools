# /// script
# dependencies = [
#   "pyttsx3",
#   "requests",
# ]
# ///

from typing import Optional, List
import pyttsx3
import os
from shinkai_local_support import get_home_path

class CONFIG:
    default_voice_id: Optional[int] = None

class INPUTS:
    text: Optional[str] = None
    voice_id: Optional[int] = None
    rate: int = 175
    list_voices: bool = False

class OUTPUT:
    voices: Optional[List[dict]] = None
    success: Optional[bool] = None
    message: Optional[str] = None
    output_path: Optional[str] = None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    try:
        engine = pyttsx3.init('sapi5')
    except Exception as e:
        output.success = False
        output.message = f"Error: Could not initialize the TTS engine. Make sure you are on Windows. Details: {e}"
        return output

    if inputs.list_voices:
        voices = engine.getProperty('voices')
        voice_list = []
        for i, voice in enumerate(voices):
            voice_list.append({
                "id": i,
                "name": voice.name,
                "id_string": voice.id,
                "languages": voice.languages,
                "gender": getattr(voice, 'gender', None),
            })
        output.voices = voice_list
        output.success = True
        output.message = f"Found {len(voice_list)} voices."
        return output

    # Validate inputs for synthesis
    if not inputs.text:
        output.success = False
        output.message = "The 'text' field is required unless listing voices."
        return output

    voices = engine.getProperty('voices')

    # Determine the voice_id to use: inputs.voice_id or config.default_voice_id
    chosen_voice_id = inputs.voice_id
    if chosen_voice_id is None and config.default_voice_id is not None:
        chosen_voice_id = config.default_voice_id

    if chosen_voice_id is not None:
        if chosen_voice_id < 0 or chosen_voice_id >= len(voices):
            output.success = False
            output.message = f"Voice ID '{chosen_voice_id}' is invalid. Use list_voices to see available voices."
            return output
        engine.setProperty('voice', voices[chosen_voice_id].id)

    # Set rate
    engine.setProperty('rate', inputs.rate)

    try:
        home_path = await get_home_path()
        wav_output_path = os.path.join(home_path, "output.wav")

        # Save speech to WAV file
        engine.save_to_file(inputs.text, wav_output_path)
        engine.runAndWait()

        output.success = True
        output.message = "WAV file saved successfully at 'output.wav' in home directory."
        output.output_path = wav_output_path
    except Exception as e:
        output.success = False
        output.message = f"An error occurred during file saving: {e}"

    return output