# /// script
# dependencies = [
#   "requests",
#   "google-genai",
# ]
# ///

from typing import Optional, Dict, Any
import os
import wave
import json
from google import genai
from google.genai import types
from shinkai_local_tools import shinkai_llm_prompt_processor
from shinkai_local_support import get_home_path

class CONFIG:
    api_key: str
    speaker_1_default_voice: str = "Kore"
    speaker_2_default_voice: str = "Puck"
    speaker_1_default_name: str = "Speaker1"
    speaker_2_default_name: str = "Speaker2"
    model_name: Optional[str] = "gemini-2.5-flash-preview-tts" # Supported: "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"

class INPUTS:
    prompt: str  # Raw conversational prompt to be processed
    speaker_1_name: Optional[str] = None # Optional name for the first speaker
    speaker_2_name: Optional[str] = None # Optional name for the second speaker
    speaker_1_voice: Optional[str] = None # Manual voice choice for speaker 1
    speaker_2_voice: Optional[str] = None # Manual voice choice for speaker 2
    voice_selection_mode: Optional[str] = "auto"  # "manual" or "auto"

class OUTPUT:
    file_path: str
    processed_prompt: str
    chosen_voice_speaker_1: str
    chosen_voice_speaker_2: str

def wave_file(filename: str, pcm: bytes, channels: int = 1, rate: int = 24000, sample_width: int = 2):
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    os.environ["GOOGLE_API_KEY"] = config.api_key

    supported_models = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"]
    model_to_use = config.model_name
    if model_to_use not in supported_models:
        model_to_use = "gemini-2.5-flash-preview-tts"

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
    
    mode = inputs.voice_selection_mode.lower() if inputs.voice_selection_mode else "manual"

    if mode == "auto":
        temp_speaker_1_name = inputs.speaker_1_name or config.speaker_1_default_name
        temp_speaker_2_name = inputs.speaker_2_name or config.speaker_2_default_name
        
        style_control_guide_for_voices = (
            "You are an expert in rewriting conversation scripts for Text-to-Speech.\n"
            f"Your task is to take a raw user prompt and convert it into a structured, turn-by-turn script for two speakers: '{temp_speaker_1_name}' and '{temp_speaker_2_name}'.\n"
            "Format each line as `SpeakerName: Dialogue...`.\n"
            "Analyze the content and add stylistic instructions where appropriate to enhance the performance.\n"
            "The final output must be ONLY the enhanced script itself, ready for the TTS engine."
        )
        combined_prompt_for_voices = f"{style_control_guide_for_voices}\n\nUser prompt:\n---\n{inputs.prompt}\n---"
        prompt_response = await shinkai_llm_prompt_processor({"prompt": combined_prompt_for_voices, "format": "text"})
        script_for_voice_selection = prompt_response.get("message", inputs.prompt)

        gender_guidance = ""
        if inputs.speaker_1_name and inputs.speaker_2_name:
            gender_guidance = (
                "\n**Gender Matching Guidance:**\n"
                f"When selecting voices for '{inputs.speaker_1_name}' and '{inputs.speaker_2_name}', "
                "please infer their likely gender from their names and choose a voice that aligns with it "
                "(e.g., a typically male-sounding voice for a name like 'David', and a typically female-sounding voice for a name like 'Sarah').\n"
                "While matching the persona and emotion in the script is the highest priority, aligning with the perceived gender of the name is also very important.\n"
            )

        voice_info_string = "\n".join([f"- {name}: {desc}" for name, desc in voice_details.items()])
        voice_selection_prompt = (
            "You are an expert assistant for selecting TTS voices.\n"
            f"Analyze the following script between '{temp_speaker_1_name}' and '{temp_speaker_2_name}'.\n"
            "Select the best voice for EACH speaker from the list based on their dialogue and style."
            f"{gender_guidance}\n"
            f"--- Voice List ---\n{voice_info_string}\n--------------------\n\n"
            f"--- Script ---\n{script_for_voice_selection}\n--------------\n\n"
            f"Return a single JSON object with two keys: '{temp_speaker_1_name}' and '{temp_speaker_2_name}', "
            f"with the chosen voice name as the value. Example: {{'{temp_speaker_1_name}': 'Kore', '{temp_speaker_2_name}': 'Puck'}}"
        )
        voice_select_response = await shinkai_llm_prompt_processor({"prompt": voice_selection_prompt, "format": "json"})
        
        chosen_voice_1 = config.speaker_1_default_voice
        chosen_voice_2 = config.speaker_2_default_voice
        try:
            voice_choices = json.loads(voice_select_response.get("message", "{}"))
            candidate_voice_1 = voice_choices.get(temp_speaker_1_name)
            candidate_voice_2 = voice_choices.get(temp_speaker_2_name)
            if candidate_voice_1 and candidate_voice_1 in possible_voices:
                chosen_voice_1 = candidate_voice_1
            if candidate_voice_2 and candidate_voice_2 in possible_voices:
                chosen_voice_2 = candidate_voice_2
        except (json.JSONDecodeError, AttributeError):
            pass

        effective_speaker_1_name = inputs.speaker_1_name or chosen_voice_1
        effective_speaker_2_name = inputs.speaker_2_name or chosen_voice_2

        processed_prompt = script_for_voice_selection
        if temp_speaker_1_name != effective_speaker_1_name:
            processed_prompt = processed_prompt.replace(f"{temp_speaker_1_name}:", f"{effective_speaker_1_name}:")
        if temp_speaker_2_name != effective_speaker_2_name:
            processed_prompt = processed_prompt.replace(f"{temp_speaker_2_name}:", f"{effective_speaker_2_name}:")

    else: # Manual mode
        chosen_voice_1 = inputs.speaker_1_voice or config.speaker_1_default_voice
        chosen_voice_2 = inputs.speaker_2_voice or config.speaker_2_default_voice
        if chosen_voice_1 not in possible_voices: chosen_voice_1 = config.speaker_1_default_voice
        if chosen_voice_2 not in possible_voices: chosen_voice_2 = config.speaker_2_default_voice

        effective_speaker_1_name = inputs.speaker_1_name or config.speaker_1_default_name
        effective_speaker_2_name = inputs.speaker_2_name or config.speaker_2_default_name

        style_control_guide = (
            "You are an expert in rewriting conversation scripts for Text-to-Speech.\n"
            f"Your task is to take a raw user prompt and convert it into a structured, turn-by-turn script for '{effective_speaker_1_name}' and '{effective_speaker_2_name}'.\n"
            "Format each line as `SpeakerName: Dialogue...`.\n"
            "The final output must be ONLY the enhanced script itself."
        )
        combined_prompt = f"{style_control_guide}\n\nUser prompt:\n---\n{inputs.prompt}\n---"
        prompt_response = await shinkai_llm_prompt_processor({"prompt": combined_prompt, "format": "text"})
        processed_prompt = prompt_response.get("message", inputs.prompt)

    client = genai.Client()
    response = client.models.generate_content(
        model=model_to_use, contents=processed_prompt,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                    speaker_voice_configs=[
                        types.SpeakerVoiceConfig(
                            speaker=effective_speaker_1_name,
                            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=chosen_voice_1))
                        ),
                        types.SpeakerVoiceConfig(
                            speaker=effective_speaker_2_name,
                            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=chosen_voice_2))
                        ),
                    ]
                )
            )
        )
    )

    audio_data = response.candidates[0].content.parts[0].inline_data.data
    home_dir = await get_home_path()
    file_path = os.path.join(home_dir, "tts_output_multi.wav")
    wave_file(file_path, audio_data)

    output.file_path = file_path
    output.processed_prompt = processed_prompt
    output.chosen_voice_speaker_1 = chosen_voice_1
    output.chosen_voice_speaker_2 = chosen_voice_2
    return output