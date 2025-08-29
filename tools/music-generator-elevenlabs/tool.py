# /// script
# dependencies = [
#   "requests",
#   "elevenlabs",
#   "python-dotenv",
#   "yt-dlp",
# ]
# ///

from typing import Any, Optional, Dict, Tuple
import os
import re
import json
import tempfile
import subprocess
from pathlib import Path

# Try to import helper tools if available in environment
try:
    from shinkai_local_tools import youtube_audio_downloader, shinkai_llm_prompt_processor  # type: ignore
except Exception:
    youtube_audio_downloader = None  # type: ignore
    shinkai_llm_prompt_processor = None  # type: ignore

try:
    from shinkai_local_support import get_home_path  # type: ignore
except Exception:
    get_home_path = None  # type: ignore

import requests

class CONFIG:
    elevenlabs_api_key: str
    llm_provider: Optional[str] = None  # used when no input music is provided
    audio_llm_provider: Optional[str] = None  # used when an input music is provided
    model_id: Optional[str] = "music_v1"
    output_format: Optional[str] = None  # the API defaults to 'mp3_44100_128', see docs
    max_composition_plan_retries: Optional[int] = 1  # default retries for composition_plan generation

class INPUTS:
    input_music: Optional[str] = None
    user_query: str
    music_length_ms: Optional[int] = None

class OUTPUT:
    success: bool
    output_file_path: Optional[str]
    error_message: Optional[str]
    composition_plan: Optional[dict]

# Full example composition plan to be included in prompts (used when processing audio references)
EXAMPLE_COMPOSITION_PLAN = """{
  "positive_global_styles": [
    "electronic",
    "fast-paced",
    "driving synth arpeggios",
    "punchy drums",
    "distorted bass",
    "glitch effects",
    "aggressive rhythmic textures",
    "high adrenaline"
  ],
  "negative_global_styles": ["acoustic", "slow", "minimalist", "ambient", "lo-fi"],
  "sections": [
    {
      "section_name": "Intro",
      "positive_local_styles": [
        "rising synth arpeggio",
        "glitch fx",
        "filtered noise sweep",
        "soft punchy kick building tension"
      ],
      "negative_local_styles": ["soft pads", "melodic vocals", "ambient textures"],
      "duration_ms": 3000,
      "lines": []
    },
    {
      "section_name": "Peak Drop",
      "positive_local_styles": [
        "full punchy drums",
        "distorted bass stab",
        "aggressive rhythmic hits",
        "rapid arpeggio sequences"
      ],
      "negative_local_styles": ["smooth transitions", "clean bass", "slow buildup"],
      "duration_ms": 4000,
      "lines": []
    },
    {
      "section_name": "Final Burst",
      "positive_local_styles": [
        "glitch stutter",
        "energy burst vox chopped sample",
        "quick transitions",
        "snare rolls"
      ],
      "negative_local_styles": ["long reverb tails", "fadeout", "gentle melodies"],
      "duration_ms": 3000,
      "lines": []
    }
  ]
}"""

# Condensed prompting guide to be added when creating music from user query only
CONDENSED_PROMPTING_GUIDE = """### **ElevenLabs Music Model: Condensed Prompting Guide**

This guide provides a streamlined approach to effectively prompt the ElevenLabs Music model. The model understands high-level concepts (e.g., *"ad for a sneaker brand"*) and detailed musical instructions.

#### **Genre, Mood, and Creativity**
*   **Adherence:** The model accurately follows genre conventions and emotional tones.
*   **Descriptors:** Use both abstract moods ("eerie," "foreboding") and specific musical details ("dissonant violin screeches").
*   **Creativity:** For more unique results, use simple, evocative keywords and allow the model creative freedom. Shorter prompts can sometimes yield more interesting outcomes.

#### **Instrument and Vocal Generation**
*   **Instrument Isolation:** To generate a single instrument track (a "stem"), use the word **"solo"** before the instrument name (e.g., *"solo electric guitar"*).
*   **Vocal Isolation:** To generate only vocals, use the term **"a cappella"** before the description (e.g., *"a cappella female vocals"*).
*   **Improving Quality:** For better stems, include musical details like key, tempo (BPM), and tone (e.g., *"a cappella vocals in A major, 90 BPM, soulful and raw"*).

#### **Musical Control**
*   **Tempo and Key:** Specify the tempo with **BPM** (e.g., *"130 BPM"*) and the musical key (e.g., *"in A minor"*) for precise control over rhythm and harmony.
*   **Vocal Delivery:** Influence vocal style with expressive terms like "raw," "live," "breathy," or "aggressive."
*   **Multiple Vocalists:** To generate harmonies, specify the number of singers (e.g., *"two singers harmonizing in C"*).

#### **Structure, Timing, and Lyrics**
*   **Song Length:** You can define a specific duration (e.g., *"60 seconds"*) or let the model decide the length automatically.
*   **Instrumentals:** To create music without any vocals, add **"instrumental only"** to your prompt.
*   **Custom Lyrics:** Provide your own lyrics for full creative control over the song's content.
*   **Vocal Timing:** Control when singing starts or stops with clear cues like *"lyrics begin at 15 seconds"* or *"instrumental only after 1:45"*.
*   **Multilingual Lyrics:** The model supports lyrics in multiple languages. You can request a language change with follow-up prompts like *"make it Japanese"*. 
"""

async def _download_youtube_mp3_via_yt_dlp(url: str, dest_dir: str) -> str:
    out_template = os.path.join(dest_dir, "%(title)s.%(ext)s")
    cmd = [
        "yt-dlp",
        "--no-warnings",
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        out_template,
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {proc.stderr.decode('utf-8', errors='ignore')}")
    mp3_files = list(Path(dest_dir).glob("*.mp3"))
    if not mp3_files:
        raise RuntimeError("yt-dlp did not produce an mp3 file")
    mp3_file = max(mp3_files, key=lambda p: p.stat().st_mtime)
    return str(mp3_file)

async def download_input_to_mp3(input_music: Optional[str]) -> Optional[str]:
    if not input_music:
        return None
    if re.match(r"^https?://", input_music):
        if youtube_audio_downloader is not None:
            try:
                result = await youtube_audio_downloader({"url": input_music})
                if isinstance(result, dict) and result.get("success"):
                    file_path = result.get("file_path")
                    if file_path:
                        return file_path
            except Exception:
                pass
        tmpdir = tempfile.mkdtemp(prefix="music_download_")
        return await _download_youtube_mp3_via_yt_dlp(input_music, tmpdir)
    else:
        p = Path(input_music)
        if not p.exists():
            raise FileNotFoundError(f"Local input file not found: {input_music}")
        return str(p.resolve())

async def _call_prompt_processor(user_query: str, mp3_path: Optional[str], llm_provider: Optional[str], retry_feedback: Optional[str] = None) -> Tuple[Optional[dict], Optional[str]]:
    """
    Returns a tuple (composition_plan_dict_or_None, raw_message_or_None).
    Only supports mp3_path != None (used for audio-based composition_plan generation).
    If retry_feedback is provided it will be appended to the prompt to guide the LLM.
    """
    if shinkai_llm_prompt_processor is None:
        return None, None

    if not mp3_path:
        return None, None

    prompt_text = (
        "You are a system that generates a music composition_plan by modifying an existing audio according to the user's query.\n\n"
        "First, you analyse the music at the given audio path fully (genre, lyrics, styles, tone, vibe, instruments, timing, harmony, etc). Then, according to the user's query, you create a composition_plan to generate a modified version of that music.\n\n"
        f"Reference audio path: {mp3_path}\n\n"
        "User query to strictly follow:\n" + user_query + "\n\n"
        "Return ONLY a valid JSON object for the composition_plan (no surrounding text). "
        "The composition_plan must follow the Eleven Labs Music API structure. "
        "Use the example below as a template and style guide for keys, casing, and section structure:\n\n"
        f"{EXAMPLE_COMPOSITION_PLAN}\n\n"
        "Ensure the composition_plan reflects the user's request and that durations are reasonable."
    )

    if retry_feedback:
        prompt_text += "\n\n" + "FEEDBACK: " + retry_feedback

    try:
        request = {"prompt": prompt_text, "format": "text", "tools": []}
        if llm_provider:
            request["llm_provider"] = llm_provider
        response = await shinkai_llm_prompt_processor(request)
        message = response.get("message", "") if isinstance(response, dict) else str(response)
        # Try direct JSON parse
        try:
            parsed = json.loads(message)
            return parsed, message
        except Exception:
            # Attempt to extract a JSON object from the text
            start = message.find("{")
            end = message.rfind("}")
            if start != -1 and end != -1 and end > start:
                candidate = message[start:end+1]
                try:
                    parsed = json.loads(candidate)
                    return parsed, message
                except Exception:
                    return None, message
            return None, message
    except Exception:
        return None, None

async def _generate_eleven_prompt_via_llm(user_query: str, mp3_path: Optional[str], llm_provider: Optional[str], include_guide: bool) -> Optional[str]:
    """
    Ask the LLM to generate a single text prompt suitable for the Eleven Labs Music API.
    Return the generated prompt string, or None on failure.
    """
    if shinkai_llm_prompt_processor is None:
        return None

    if mp3_path:
        instruction = (
            "You will generate a single text string that will be used as the 'prompt' field when calling the Eleven Labs Music API (/v1/music). "
            "Do NOT generate music or a composition plan. Return ONLY the prompt string (no JSON, no code blocks, no explanations).\n\n"
            f"Reference audio path: {mp3_path}\n\n"
            "User instructions to encode into the prompt:\n" + user_query + "\n\n"
        )
    else:
        instruction = (
            "You will generate a single text string that will be used as the 'prompt' field when calling the Eleven Labs Music API (/v1/music). "
            "Do NOT generate music or a composition plan. Return ONLY the prompt string (no JSON, no code blocks, no explanations).\n\n"
            "User instructions to encode into the prompt:\n" + user_query + "\n\n"
        )

    if include_guide:
        instruction += "When crafting the prompt, follow this condensed prompting guide to include useful parameters (tempo, key, instrumentation, stems, vocal style, structure, timings, lyrics instructions, etc.):\n\n"
        instruction += CONDENSED_PROMPTING_GUIDE + "\n\n"

    instruction += (
        "Guidelines for the final prompt:\n"
        "- Keep it from concise to mid-length but include essential musical details: genre, mood, tempo (BPM), key if specified, main instruments, vocal instructions or 'instrumental only', structure cues, eventual lyrics and any lyrics timing.\n"
        "- The prompt should be directly usable with Eleven Labs' 'prompt' field and be <=2000 characters if possible.\n"
        "- Return only the plain text prompt string.\n"
    )

    try:
        request = {"prompt": instruction, "format": "text", "tools": []}
        if llm_provider:
            request["llm_provider"] = llm_provider
        response = await shinkai_llm_prompt_processor(request)
        message = response.get("message", "") if isinstance(response, dict) else str(response)
        # Clean message: strip surrounding whitespace and possible triple backticks
        msg = message.strip()
        # Remove surrounding backticks or code fences if present
        if msg.startswith("```") and msg.endswith("```"):
            # remove first and last fence
            lines = msg.splitlines()
            if len(lines) >= 3:
                return "\n".join(lines[1:-1]).strip()
        # If the model added "Prompt:" prefix, strip it
        if msg.lower().startswith("prompt:"):
            return msg[len("prompt:"):].strip()
        return msg
    except Exception:
        return None

def _save_binary_to_file(content: bytes, dest_dir: str, filename_prefix: str = "eleven_music", output_format: str = "mp3") -> str:
    Path(dest_dir).mkdir(parents=True, exist_ok=True)
    filename = f"{filename_prefix}.{output_format}"
    full_path = Path(dest_dir) / filename
    with open(full_path, "wb") as f:
        f.write(content)
    return str(full_path.resolve())

def _is_valid_composition_plan_structure(plan: Any) -> bool:
    """
    Checks if the provided object has the exact structure of a valid composition plan.
    """
    if not isinstance(plan, dict):
        return False

    required_top_level_keys = {"positive_global_styles", "negative_global_styles", "sections"}
    if not required_top_level_keys.issubset(plan.keys()):
        return False

    if not isinstance(plan["positive_global_styles"], list) or not all(isinstance(s, str) for s in plan["positive_global_styles"]):
        return False
    if not isinstance(plan["negative_global_styles"], list) or not all(isinstance(s, str) for s in plan["negative_global_styles"]):
        return False

    if not isinstance(plan["sections"], list):
        return False

    required_section_keys = {"section_name", "positive_local_styles", "negative_local_styles", "duration_ms", "lines"}
    # Sections list can be empty, which is valid
    if not plan["sections"]:
        return True
        
    for section in plan["sections"]:
        if not isinstance(section, dict):
            return False
        if not required_section_keys.issubset(section.keys()):
            return False
        if not isinstance(section["section_name"], str):
            return False
        if not isinstance(section["positive_local_styles"], list) or not all(isinstance(s, str) for s in section["positive_local_styles"]):
            return False
        if not isinstance(section["negative_local_styles"], list) or not all(isinstance(s, str) for s in section["negative_local_styles"]):
            return False
        if not isinstance(section["duration_ms"], int):
            return False
        if not isinstance(section["lines"], list):
            return False
            
    return True

def _get_file_extension(output_format: Optional[str]) -> str:
    """
    Determines the file extension based on the specified output format,
    relying on the API's documented default if none is provided.
    """
    # If output_format is not specified, the API reliably defaults to mp3.
    if not output_format:
        return 'mp3'

    # If a format is specified, parse the codec from the string.
    codec = output_format.split('_')[0].lower()

    # PCM and μ-law (ulaw) data are typically stored in WAV containers.
    if codec in ('pcm', 'ulaw'):
        return 'wav'
    
    # For 'mp3' or any other/new format, default to 'mp3'.
    # This covers the primary case and provides a safe fallback.
    return 'mp3'

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.success = False
    output.output_file_path = None
    output.error_message = None
    output.composition_plan = None

    api_key = getattr(config, "elevenlabs_api_key", None)
    if not api_key:
        output.error_message = "Eleven Labs API key not provided in config.elevenlabs_api_key"
        return output

    home_dir = None
    if get_home_path is not None:
        try:
            maybe_home = await get_home_path()
            if maybe_home:
                home_dir = maybe_home
        except Exception:
            home_dir = None
    if not home_dir:
        home_dir = os.getcwd()

    try:
        mp3_path = await download_input_to_mp3(getattr(inputs, "input_music", None))
    except Exception as e:
        output.error_message = f"Failed to retrieve input audio: {str(e)}"
        return output

    composition_plan = None
    composition_raw_message = None
    fallback_to_prompt_only = False

    # Only attempt to generate a composition_plan via the LLM when there is an input audio reference.
    if mp3_path:
        provider = getattr(config, "audio_llm_provider", None)
        retries = getattr(config, "max_composition_plan_retries", 1) or 1
        if not isinstance(retries, int) or retries < 1:
            retries = 1
        retry_feedback = None
        for attempt in range(retries):
            parsed, raw = await _call_prompt_processor(inputs.user_query, mp3_path, provider, retry_feedback)
            composition_raw_message = raw

            if parsed and _is_valid_composition_plan_structure(parsed):
                composition_plan = parsed
                break  # Success, valid structure found
            else:
                composition_plan = None # Ensure it's None for the next loop or fallback

            # Prepare feedback for the next attempt
            if raw:
                snippet = raw if len(raw) < 1000 else raw[:1000] + "...(truncated)"
                if parsed is None:  # It wasn't even valid JSON
                    retry_feedback = (
                        "The previous output was not valid JSON. Previous output (truncated):\n"
                        + snippet
                        + "\n\nPlease output ONLY a valid JSON object matching the composition_plan structure (keys and casing as in the example)."
                    )
                else:  # It was valid JSON but had the wrong structure
                    retry_feedback = (
                        "The previous output was valid JSON but had an incorrect structure. Previous output (truncated):\n"
                        + snippet
                        + "\n\nPlease ensure the output strictly follows the required structure. It must have top-level keys 'positive_global_styles', 'negative_global_styles', and 'sections'. "
                        "Each item in 'sections' must be an object with keys 'section_name', 'positive_local_styles', 'negative_local_styles', 'duration_ms', and 'lines'. "
                        "Double-check all key names, casing, and value types (lists, strings, integers)."
                    )
            else:
                retry_feedback = "Previous attempt produced no output or an error. Please output ONLY a valid JSON object matching the composition_plan structure."

        if not composition_plan:
            # After retries, fallback to prompt-only mode with condensed guide but require LLM prompt generation
            fallback_to_prompt_only = True
    else:
        # No input music - we will not generate composition_plan (compose via prompt only)
        composition_plan = None
        fallback_to_prompt_only = True

    payload: Dict[str, Any] = {}
    if composition_plan and not fallback_to_prompt_only:
        payload["composition_plan"] = composition_plan
        output.composition_plan = composition_plan
    else:
        # Build prompt-only flow: require the LLM to generate the prompt string to send to ElevenLabs.
        if mp3_path:
            provider_for_prompt = getattr(config, "audio_llm_provider", None)
            generated_prompt = await _generate_eleven_prompt_via_llm(inputs.user_query, mp3_path, provider_for_prompt, include_guide=True)
            if not generated_prompt:
                # Do NOT send ad-hoc prompts to ElevenLabs. Return error explaining LLM prompt creation failure.
                err_parts = ["Failed to generate Eleven Labs prompt via LLM for audio-based creation."]
                if composition_raw_message:
                    snippet = composition_raw_message if len(composition_raw_message) < 1000 else composition_raw_message[:1000] + "...(truncated)"
                    err_parts.append("Last composition_plan attempt output (truncated): " + snippet)
                err_parts.append("No prompt was created; cannot call Eleven Labs API with an unstructured prompt.")
                output.error_message = "\n\n".join(err_parts)
                return output
            payload["prompt"] = generated_prompt
        else:
            provider_for_prompt = getattr(config, "llm_provider", None)
            generated_prompt = await _generate_eleven_prompt_via_llm(inputs.user_query, None, provider_for_prompt, include_guide=True)
            if not generated_prompt:
                output.error_message = "Failed to generate Eleven Labs prompt via LLM for music creation. No prompt available to call Eleven Labs API."
                return output
            payload["prompt"] = generated_prompt

        if inputs.music_length_ms is not None:
            payload["music_length_ms"] = inputs.music_length_ms

    model_id = getattr(config, "model_id", None)
    if model_id:
        payload["model_id"] = model_id

    output_format = getattr(config, "output_format", None)
    params = {}
    if output_format:
        params["output_format"] = output_format

    if "prompt" in payload and "music_length_ms" in payload:
        if payload["music_length_ms"] < 10000 or payload["music_length_ms"] > 300000:
            output.error_message = "music_length_ms must be between 10000 and 300000 milliseconds"
            return output

    try:
        url = "https://api.elevenlabs.io/v1/music"
        headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
        resp = requests.post(url, json=payload, headers=headers, params=params, timeout=300)
    except Exception as e:
        output.error_message = f"Failed to call Eleven Labs Music API: {str(e)}"
        return output

    if resp.status_code >= 400:
        try:
            err = resp.json()
            err_msg = json.dumps(err)
        except Exception:
            err_msg = resp.text
        output.error_message = f"Eleven Labs API returned error {resp.status_code}: {err_msg}"
        return output
    
    # Use the simplified and more direct logic to determine file extension.
    ext = _get_file_extension(output_format)

    try:
        dest_dir = os.path.join(home_dir, "generated_music")
        filename_prefix = "eleven_music_track"
        saved_path = _save_binary_to_file(resp.content, dest_dir, filename_prefix, ext)
        output.output_file_path = saved_path
        output.success = True
        return output
    except Exception as e:
        output.error_message = f"Failed to save generated audio: {str(e)}"
        return output