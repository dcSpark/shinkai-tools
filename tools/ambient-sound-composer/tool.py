# /// script
# dependencies = [
#   "requests"
# ]
# ///

from typing import Any, Optional, List, Dict
import os
import json
import asyncio
import math
from datetime import datetime
from pathlib import Path
import time
import shlex
import subprocess
import tempfile

from shinkai_local_tools import shinkai_llm_prompt_processor
from shinkai_local_support import get_home_path

import requests

class CONFIG:
    assets_folder: str
    force_download: Optional[bool] = False
    llm_provider: Optional[str] = None
    github_repo_api_url: Optional[str] = "https://api.github.com/repos/remvze/moodist/contents/public/sounds"
    llm_max_retries: Optional[int] = 2

class INPUTS:
    prompt: Optional[str] = None
    duration_minutes: Optional[int] = 20
    max_sounds: Optional[int] = 5
    download_assets: Optional[bool] = False
    show_available_sounds: Optional[bool] = False

class OUTPUT:
    generated_mp3_path: str
    composition_path: str
    composition: Dict[str, Any]
    downloaded_files: List[str]
    available_sounds: Optional[Any] = None
    message: Optional[str] = None

def _format_sounds_for_display(sounds: List[Dict[str, str]], base_path: Path) -> Dict[str, Any]:
    """
    Transforms a flat list of sounds into a nested dictionary representing the folder structure.
    This is intended for human-readable output.
    """
    categorized_full = {}
    for sound in sounds:
        sound_path = Path(sound['src'])
        try:
            relative_dir = sound_path.parent.relative_to(base_path)
            path_parts = relative_dir.parts
        except ValueError:
            path_parts = []

        current_level = categorized_full
        for part in path_parts:
            current_level = current_level.setdefault(part, {})
        current_level[sound['id']] = sound['label']

    def simplify_tree(node: dict):
        if all(isinstance(v, str) for v in node.values()):
            return sorted(list(node.keys()))
        
        return {
            k: simplify_tree(v) if isinstance(v, dict) else v
            for k, v in node.items()
        }

    return simplify_tree(categorized_full)


async def _call_llm_async(payload: Dict[str, Any]) -> Dict[str, Any]:
    return await shinkai_llm_prompt_processor(payload)

def fetch_sound_assets_from_github(api_url: str) -> List[Dict[str, str]]:
    print(f"Discovering sound assets from: {api_url}")
    assets: List[Dict[str, str]] = []
    paths_to_visit = [api_url]
    headers = {'Accept': 'application/vnd.github.v3+json'}
    while paths_to_visit:
        current_api_url = paths_to_visit.pop()
        try:
            response = requests.get(current_api_url, headers=headers, timeout=20)
            response.raise_for_status()
            contents = response.json()
            for item in contents:
                if item.get('type') == 'file' and item.get('name', '').endswith(('.mp3', '.wav')):
                    repo_path = item['path']
                    local_relative_path = repo_path.replace('public/', '', 1)
                    assets.append({
                        "local_relative_path": local_relative_path,
                        "download_url": item.get('download_url')
                    })
                elif item.get('type') == 'dir' and 'url' in item:
                    paths_to_visit.append(item['url'])
            if 'X-RateLimit-Remaining' in response.headers and int(response.headers['X-RateLimit-Remaining']) < 5:
                print("Approaching GitHub API rate limit, sleeping for 60 seconds...")
                time.sleep(60)
        except requests.RequestException as e:
            print(f"Error fetching directory contents from {current_api_url}: {e}")
            if current_api_url == api_url:
                raise RuntimeError(f"Could not discover assets from GitHub API. Please check the URL: {api_url}") from e
    print(f"Discovered {len(assets)} sound assets in the repository.")
    return assets

def _ffmpeg_exists() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except Exception:
        return False

def _build_ffmpeg_mix(sound_items: List[Dict[str, Any]], duration_ms: int, output_path: str) -> None:
    duration_sec = max(1, int(math.ceil(duration_ms / 1000.0)))
    cmd = ["ffmpeg", "-y"]
    filter_parts = []
    amix_inputs = []
    for idx, item in enumerate(sound_items):
        src = item["src"]
        vol = item.get("volume", 1.0)
        cmd += ["-stream_loop", str(100000), "-i", str(src)]
        vol_filter = f"[{idx}:a]volume={vol}[a{idx}];"
        filter_parts.append(vol_filter)
        amix_inputs.append(f"[a{idx}]")
    filter_chain = ""
    if filter_parts:
        filter_chain += "".join(filter_parts)
        amix_count = len(sound_items)
        amix_inputs_str = "".join(amix_inputs)
        filter_chain += f"{amix_inputs_str}amix=inputs={amix_count}:normalize=0,volume=1,atrim=0:{duration_sec}[outa]"
    if filter_chain:
        cmd += ["-filter_complex", filter_chain, "-map", "[outa]", "-t", str(duration_sec), "-c:a", "libmp3lame", "-b:a", "192k", str(output_path)]
    else:
        raise RuntimeError("No inputs for ffmpeg mixing.")
    subprocess.run(cmd, check=True)

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    if not getattr(config, "assets_folder", None):
        raise ValueError("config.assets_folder is a required field.")

    home_path = await get_home_path()
    assets_root = Path(home_path) / config.assets_folder.strip("/\\")
    assets_root.mkdir(parents=True, exist_ok=True)
    downloaded_files: List[str] = []
    output = OUTPUT()
    output.available_sounds = None

    if inputs.download_assets:
        all_assets_info = fetch_sound_assets_from_github(getattr(config, "github_repo_api_url", None))
        print(f"Checking for {len(all_assets_info)} sound assets in local cache: {assets_root}...")
        for asset_info in all_assets_info:
            if not asset_info.get("download_url"):
                continue
            local_path = assets_root / asset_info["local_relative_path"]
            if not local_path.is_file() or getattr(config, "force_download", False):
                local_path.parent.mkdir(parents=True, exist_ok=True)
                url = asset_info['download_url']
                try:
                    print(f"Downloading: {asset_info['local_relative_path']}")
                    resp = requests.get(url, timeout=60)
                    resp.raise_for_status()
                    with open(local_path, "wb") as f:
                        f.write(resp.content)
                    downloaded_files.append(str(local_path.resolve()))
                except requests.RequestException as e:
                    print(f"Warning: Could not download {url}. Error: {e}. This sound will be unavailable.")

    available_sounds: List[Dict[str, str]] = []
    if assets_root.exists():
        for root, _, files in os.walk(assets_root):
            for file in files:
                if file.endswith(('.mp3', '.wav')):
                    file_path = Path(root) / file
                    sound_id = file_path.stem
                    label = sound_id.replace("-", " ").replace("_", " ").title()
                    available_sounds.append({"id": sound_id, "label": label, "src": str(file_path.resolve())})

    if inputs.show_available_sounds:
        display_sounds = _format_sounds_for_display(available_sounds, assets_root)

        if len(display_sounds) == 1 and "sounds" in display_sounds:
            display_sounds = display_sounds["sounds"]

        message = (f"Found {len(available_sounds)} available sound(s), organized by category.")
        print(message)
        output.available_sounds = display_sounds
        output.downloaded_files = downloaded_files
        output.message = message
        return output

    if not inputs.prompt:
        raise ValueError("A 'prompt' is required to generate a soundscape.")

    if not available_sounds:
        raise RuntimeError(
            "No local sound assets found. Please run this script again with the "
            "'download_assets' input set to true to download the required sound files."
        )
    
    catalog_map = {c["id"]: c for c in available_sounds}
    
    categorized_for_llm = {}
    for sound in available_sounds:
        try:
            relative_path = Path(sound['src']).relative_to(assets_root.joinpath('sounds'))
            category = relative_path.parts[0] if len(relative_path.parts) > 1 else "general"
        except ValueError:
            category = "general"
        
        if category not in categorized_for_llm:
            categorized_for_llm[category] = []
        categorized_for_llm[category].append(sound['id'])

    llm_catalog_lines = []
    for category, ids in sorted(categorized_for_llm.items()):
        llm_catalog_lines.append(f"\nCATEGORY: {category.upper()}")
        for sound_id in sorted(ids):
            llm_catalog_lines.append(f"- {sound_id}")
    llm_catalog_str = "\n".join(llm_catalog_lines)

    max_sounds = inputs.max_sounds or 5
    llm_instruction = f"""
You are an expert sound designer who creates ambient soundscapes.
Based on the user's prompt, select up to {max_sounds} sounds from the provided catalog to create a mix.

Your response MUST be a JSON object with the following structure:
{{
  "sounds": [
    {{"id": "sound-id-from-catalog", "volume": 0.75}},
    ...
  ],
  "notes": "A brief explanation of your choices for the soundscape."
}}

RULES:
- Only use sound IDs from the catalog (e.g., 'birds-singing').
- The 'volume' must be a number between 0.0 and 1.0.
- The category names (e.g., 'CATEGORY: NATURE') are for context only. Do NOT include them in your JSON response.
- Choose sounds that best match the mood and elements of the user's prompt.
- Include background noise and or bineural only if appropriate and asked by the user.

CATALOG OF AVAILABLE SOUNDS:{llm_catalog_str}

USER PROMPT:
"{inputs.prompt}"

Now, provide ONLY the JSON object as your response.
"""
    
    # --- NEW: Smart Retry Logic ---
    composition_recipe: Optional[Dict[str, Any]] = None
    last_error_feedback = ""
    max_retries = getattr(config, "llm_max_retries", 2)
    total_attempts = max_retries + 1

    for attempt in range(total_attempts):
        print(f"--- LLM Call Attempt {attempt + 1}/{total_attempts} ---")
        
        current_llm_instruction = llm_instruction
        if last_error_feedback:
            print(f"Providing feedback to LLM: {last_error_feedback}")
            correction_prompt = (
                f"Your previous attempt failed. Please correct the following error and try again:\n"
                f"ERROR: {last_error_feedback}\n\n"
                f"Here is the original request again:"
            )
            current_llm_instruction = f"{correction_prompt}\n{llm_instruction}"
        
        llm_text = ""
        try:
            llm_resp = await _call_llm_async({"prompt": current_llm_instruction, "format": "text", "llm_provider": getattr(config, "llm_provider", None)})
            llm_text = llm_resp.get("message", "") or ""
        except Exception as e:
            raise RuntimeError(f"The call to the LLM failed on attempt {attempt + 1}: {e}")

        # Validate the LLM's response
        try:
            json_start = llm_text.find("{")
            json_end = llm_text.rfind("}") + 1
            if json_start == -1 or json_end == -1:
                raise ValueError("No JSON object found in the response.")
            
            parsed_json = json.loads(llm_text[json_start:json_end])
            
            # Check if there are any valid sounds in the recipe
            valid_sounds_in_recipe = []
            invalid_ids = []
            for sound_item in parsed_json.get("sounds", []):
                sound_id = sound_item.get("id")
                if sound_id in catalog_map:
                    valid_sounds_in_recipe.append(sound_id)
                else:
                    invalid_ids.append(str(sound_id))
            
            if not valid_sounds_in_recipe:
                if invalid_ids:
                    last_error_feedback = f"You selected one or more sound IDs that are not in the catalog. The invalid IDs were: {', '.join(invalid_ids)}. Please select ONLY from the catalog."
                else:
                    last_error_feedback = "Your JSON response was valid but the 'sounds' array was empty or contained no valid sounds. Please select at least one sound from the catalog."
                continue # Go to the next retry attempt

            # Success! We have a valid recipe with at least one usable sound.
            composition_recipe = parsed_json
            print("LLM provided a valid composition.")
            break # Exit the retry loop

        except (json.JSONDecodeError, ValueError) as e:
            last_error_feedback = f"The response was not valid JSON. Please ensure your response is ONLY a single, correctly formatted JSON object. Error: {e}."
            # Loop will continue to the next attempt

    if not composition_recipe:
        raise RuntimeError(
            f"The LLM failed to produce a valid sound composition after {total_attempts} attempts. "
            f"Last known error: {last_error_feedback}"
        )
    # --- END of Smart Retry Logic ---

    duration_ms = (inputs.duration_minutes or 20) * 60 * 1000
    final_selection: List[Dict[str, Any]] = []

    print("Preparing selection for mixing:")
    for sound_item in composition_recipe.get("sounds", []):
        sound_id = sound_item.get("id")
        if sound_id in catalog_map:
            src_path = catalog_map[sound_id]["src"]
            volume_linear = max(0.0, min(1.0, float(sound_item.get("volume", 0.5))))
            final_selection.append({"id": sound_id, "label": catalog_map[sound_id]["label"], "src": src_path, "volume": volume_linear})
            print(f"- Selected {sound_id} at volume {volume_linear:.2f}")
        else:
            # This handles the partial success case where the final LLM answer had some invalid sounds
            print(f"Warning: Sound id '{sound_id}' from the final LLM response was not found in catalog. Skipping.")

    home_path_obj = Path(home_path)
    output_dir = home_path_obj / f"soundist_output"
    output_dir.mkdir(parents=True, exist_ok=True)
    composition_id = f"composition-{int(datetime.utcnow().timestamp())}"

    composition_data = {
        "id": composition_id,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "prompt": inputs.prompt,
        "durationMinutes": inputs.duration_minutes,
        "sounds": final_selection,
        "notes": composition_recipe.get("notes", "No notes provided."),
    }

    json_path = output_dir / f"{composition_id}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(composition_data, f, indent=2)

    mp3_path = output_dir / f"{composition_id}.mp3"
    print(f"Exporting final mix to: {mp3_path}")

    use_pydub = False
    try:
        from pydub import AudioSegment
        _ = AudioSegment.silent(duration=100)
        use_pydub = True
    except Exception as e:
        print(f"pydub unavailable or causes import issues (fallback to ffmpeg): {e}")
        use_pydub = False

    try:
        if use_pydub:
            from pydub import AudioSegment
            final_mix = AudioSegment.silent(duration=duration_ms)
            for sel in final_selection:
                try:
                    seg = AudioSegment.from_file(sel["src"])
                    vol = sel.get("volume", 1.0)
                    vol_db = 20 * math.log10(vol) if vol > 0 else -120
                    final_mix = final_mix.overlay(seg + vol_db, loop=True)
                except Exception as e:
                    print(f"Warning: pydub failed to process {sel['src']}: {e}")
            try:
                final_mix.export(str(mp3_path), format="mp3", bitrate="192k")
            except Exception as e:
                print(f"pydub export failed, attempting ffmpeg fallback: {e}")
                raise
        else:
            if not _ffmpeg_exists():
                raise RuntimeError("ffmpeg not found in PATH. Cannot export audio without ffmpeg.")
            if not final_selection:
                 # This case should be rare now because the retry loop ensures we have at least one valid sound
                raise RuntimeError("No valid sound selections to mix.")
            _build_ffmpeg_mix(final_selection, duration_ms, str(mp3_path))
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg failed during mixing: {e}") from e

    output.generated_mp3_path = str(Path(mp3_path).resolve())
    output.composition_path = str(Path(json_path).resolve())
    output.composition = composition_data
    output.downloaded_files = downloaded_files
    output.available_sounds = None
    output.message = f"Successfully generated soundscape at {output.generated_mp3_path}"

    return output