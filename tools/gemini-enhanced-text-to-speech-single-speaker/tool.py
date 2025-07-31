# /// script
# dependencies = [
#   "requests",
#   "google-genai",
# ]
# ///

from typing import Optional, Dict, Any
import os
import wave
from google import genai
from google.genai import types
from shinkai_local_tools import shinkai_llm_prompt_processor
from shinkai_local_support import get_home_path

class CONFIG:
    api_key: str
    voice_name: str = "Kore"  # default voice
    model_name: Optional[str] = "gemini-2.5-flash-preview-tts" # Supported: "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"

class INPUTS:
    prompt: str  # raw prompt to be processed by the prompt processor
    voice_name: Optional[str] = None
    voice_selection_mode: Optional[str] = "auto"  # "manual" or "auto"

class OUTPUT:
    file_path: str
    processed_prompt: str
    chosen_voice: str

def wave_file(filename: str, pcm: bytes, channels: int = 1, rate: int = 24000, sample_width: int = 2):
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()

    os.environ["GOOGLE_API_KEY"] = config.api_key

    # Supported TTS models
    supported_models = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"]
    
    # Validate the model name from config, fallback to default if invalid
    model_to_use = config.model_name
    if model_to_use not in supported_models:
        model_to_use = "gemini-2.5-flash-preview-tts"

    # Style control guide for the LLM prompt processor
    style_control_guide = (
        "Controlling speech style with prompts:\n"
        "You can control style, tone, accent, and pace using natural language prompts for TTS. "
        "For example, in a single-speaker prompt, you can say:\n\n"
        "Say in an spooky whisper:\n"
        "\"By the pricking of my thumbs...\n"
        "Something wicked this way comes\"\n\n"
        "Use this guide to produce a refined prompt that controls the speech style, matching best the intent from the user prompt."
        "Your refined prompt starts with the style instructions, and follows with the full content to convert to speech."
        "Keep in mind that a text-to-speech session has a context window limit of max 32k tokens, which equals around max 22400 words."
    )

    # Combine style control guide with user prompt
    combined_prompt = f"{style_control_guide}\n\nUser prompt:\n{inputs.prompt}"

    # First prompt processor call: process the user prompt
    prompt_processor_input: Dict[str, Any] = {
        "prompt": combined_prompt,
        "format": "text",
    }
    prompt_response = await shinkai_llm_prompt_processor(prompt_processor_input)
    processed_prompt = prompt_response.get("message", inputs.prompt)

    # Voice options with descriptions
    voice_details = {
        "Zephyr": "Bright", "Puck": "Upbeat", "Charon": "Informative",
        "Kore": "Firm", "Fenrir": "Excitable", "Leda": "Youthful",
        "Orus": "Firm", "Aoede": "Breezy", "Callirrhoe": "Easy-going",
        "Autonoe": "Bright", "Enceladus": "Breathy", "Iapetus": "Clear",
        "Umbriel": "Easy-going", "Algieba": "Smooth", "Despina": "Smooth",
        "Erinome": "Clear", "Algenib": "Gravelly", "Rasalgethi": "Informative",
        "Laomedeia": "Upbeat", "Achernar": "Soft", "Alnilam": "Firm",
        "Schedar": "Even", "Gacrux": "Mature", "Pulcherrima": "Forward",
        "Achird": "Friendly", "Zubenelgenubi": "Casual", "Vindemiatrix": "Gentle",
        "Sadachbia": "Lively", "Sadaltager": "Knowledgeable", "Sulafat": "Warm"
    }
    possible_voices = list(voice_details.keys())


    # Determine chosen voice
    chosen_voice = config.voice_name
    mode = inputs.voice_selection_mode.lower() if inputs.voice_selection_mode else "manual"

    if mode == "auto":
        # Format the voice details for the prompt
        voice_info_string = "\n".join([f"- {name}: {desc}" for name, desc in voice_details.items()])

        # Compose prompt for voice selection
        voice_selection_prompt = (
            "You are an expert assistant that selects the best TTS voice from the following list "
            "based on the style, tone, and emotion in the provided prompt.\n\n"
            "Analyze the prompt and choose the voice whose characteristic best matches it.\n"
            "Return ONLY the single voice name from the list. Do not add any other text or explanation.\n\n"
            "--- Voice List ---\n"
            f"{voice_info_string}\n"
            "--------------------\n\n"
            f"Prompt to analyze:\n\"{processed_prompt}\"\n\n"
            "Selected voice:"
        )
        voice_select_input = {
            "prompt": voice_selection_prompt,
            "format": "text",
        }
        voice_select_response = await shinkai_llm_prompt_processor(voice_select_input)
        candidate_voice = voice_select_response.get("message", "").strip()
        # Validate candidate voice
        if candidate_voice in possible_voices:
            chosen_voice = candidate_voice
        else:
            # Fallback to default if LLM returns an invalid voice
            chosen_voice = config.voice_name
    else:
        # Manual mode: use input voice if given and valid, else config default
        input_voice = inputs.voice_name
        if input_voice and input_voice in possible_voices:
            chosen_voice = input_voice
        else:
            chosen_voice = config.voice_name

    client = genai.Client()

    response = client.models.generate_content(
        model=model_to_use,
        contents=processed_prompt,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=chosen_voice
                    )
                )
            )
        )
    )

    audio_data = response.candidates[0].content.parts[0].inline_data.data

    home_dir = await get_home_path()
    file_path = os.path.join(home_dir, "tts_output.wav")

    wave_file(file_path, audio_data)

    output.file_path = file_path
    output.processed_prompt = processed_prompt
    output.chosen_voice = chosen_voice
    return output