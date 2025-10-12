# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
from datetime import datetime, timezone
from math import isclose
import json
import os

from shinkai_local_tools import ambient_sound_composer, mp3_concatenator, shinkai_llm_prompt_processor
from shinkai_local_support import get_home_path


class CONFIG:
    llm_composition_retries: Optional[int] = 2
    llm_provider: Optional[str] = None


class INPUTS:
    request: str
    total_duration_minutes: Optional[float] = None
    segments: Optional[int] = None
    max_segments: Optional[int] = None
    min_segment_minutes: Optional[float] = None
    max_sounds_per_segment: Optional[int] = None
    ensure_assets: Optional[bool] = None
    output_filename: Optional[str] = None
    optional_output_path: Optional[str] = None
    show_available_sounds: Optional[bool] = False
    show_composition: Optional[bool] = False
    keep_intermediate_files: Optional[bool] = False


class OUTPUT:
    message: str
    global_theme: Optional[str] = None
    available_sounds: Optional[Dict[str, Any]] = None
    composition_details: Optional[List[Dict[str, Any]]] = None
    final_mp3_path: Optional[str] = None


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return default


def _normalize_durations(
    durations: List[float],
    total: float,
    min_segment: float
) -> List[float]:
    durations = [max(d, min_segment) for d in durations]
    s = sum(durations)
    if s <= 0:
        n = len(durations)
        even = max(total / max(n, 1), min_segment)
        return [even] * n

    scale = total / s if s != 0 else 1.0
    scaled = [d * scale for d in durations]

    diff = total - sum(scaled)
    if abs(diff) > 1e-6 and len(scaled) > 0:
        scaled[-1] = max(scaled[-1] + diff, min_segment)

    s2 = sum(scaled)
    if not isclose(s2, total, rel_tol=1e-4, abs_tol=1e-4) and s2 > 0:
        scale2 = total / s2
        scaled = [max(d * scale2, min_segment) for d in scaled]
        final_diff = total - sum(scaled)
        if len(scaled) > 0:
            scaled[-1] = max(scaled[-1] + final_diff, min_segment)

    return scaled


def _build_plan_prompt(
    user_request: str,
    total_minutes: float,
    desired_segments: Optional[int],
    max_segments: int,
    min_segment_minutes: float,
    max_sounds_per_segment: int,
    available_sounds_summary: str
) -> str:
    guidance = f"""
You are designing a progressive ambient sound journey that is continuous and evolves gradually.

Constraints and goals:
- Total exact duration: {total_minutes:.4f} minutes.
- Target number of segments: {"exactly " + str(desired_segments) if desired_segments else "between 4 and " + str(max_segments)}.
- Each segment must be at least {min_segment_minutes:.2f} minutes long.
- Durations of all segments MUST sum exactly to the total duration.
- Maximum sounds (layers) per segment: {max_sounds_per_segment}.
- The journey must feel continuous. Changes should be subtle between adjacent segments.
- The last 3-5 seconds of each segment must be stable to prepare for the next segment.
- To make transitions smoother, use volume dynamics. To introduce a new sound, consider a short intermediary segment where its volume is very low (e.g., 0.1) before raising it. To remove a sound, you can lower its volume over one or two segments before it disappears completely. This creates a natural fade in/out effect. Do not use this if aiming for sudden changes.

User request:
{user_request}

Available sound palette summary (categories and examples):
{available_sounds_summary}

Respond ONLY with a valid JSON object with this schema:
{{
  "global_theme": "one to two sentences global theme for the whole journey",
  "total_minutes": {total_minutes:.4f},
  "segments": [
    {{
      "index": 1,
      "title": "short evocative name",
      "duration_minutes": 1.25,
      "goal": "what changes compared to previous segment (for index=1: how to begin)",
      "elements": {{
        "core": ["persistent elements to keep through the segment"],
        "adds": ["one or two new or stronger elements"],
        "removes": ["elements to soften or remove (if any)"]
      }},
      "prompt": "very detailed, concrete prompt focusing on micro-changes, stability at the end, and smooth continuity"
    }}
  ],
  "notes": "global guidance for coherence and progression"
}}

Rules:
- Ensure durations sum to EXACTLY {total_minutes:.4f}.
- Avoid large jumps between segments.
- Keep prompts concise but precise; focus on continuity details.
"""
    return guidance.strip()


def _get_all_sounds(data: Any) -> List[str]:
    sounds = []
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, list):
                sounds.extend(value)
            else:
                sounds.extend(_get_all_sounds(value))
    elif isinstance(data, list):
        sounds.extend(data)
    return list(set(sounds))


async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()

    available_sounds_data: Optional[Dict[str, Any]] = None
    sound_id_list: List[str] = []
    try:
        res_list = await ambient_sound_composer({"show_available_sounds": True})
        if isinstance(res_list, dict) and res_list.get("available_sounds"):
            available_sounds_data = res_list["available_sounds"]
            sound_id_list = _get_all_sounds(available_sounds_data)
    except Exception as e:
        print(f"Could not retrieve available sounds: {e}")

    if inputs.show_available_sounds:
        output.available_sounds = available_sounds_data
        output.message = f"Found {len(sound_id_list)} available sound assets across all categories."
        return output

    total_minutes = inputs.total_duration_minutes if inputs.total_duration_minutes and inputs.total_duration_minutes > 0 else 5.0
    desired_segments = inputs.segments if inputs.segments and inputs.segments > 0 else None
    max_segments = inputs.max_segments if inputs.max_segments and inputs.max_segments > 0 else 10
    min_segment_minutes = inputs.min_segment_minutes if inputs.min_segment_minutes and inputs.min_segment_minutes > 0 else 0.15
    max_sounds_per_segment = inputs.max_sounds_per_segment if inputs.max_sounds_per_segment and inputs.max_sounds_per_segment > 0 else 6
    ensure_assets = bool(inputs.ensure_assets)

    if ensure_assets:
        print("Ensuring sound assets are available...")
        try:
            await ambient_sound_composer({"download_assets": True})
        except Exception as e:
            print(f"Warning: Could not ensure assets. Proceeding with existing ones. Error: {e}")

    sounds_summary = "\n".join(sorted(sound_id_list)) if sound_id_list else "No local sounds found."

    print("Generating a plan for the ambient journey...")
    plan_prompt = _build_plan_prompt(
        user_request=inputs.request, total_minutes=total_minutes, desired_segments=desired_segments,
        max_segments=max_segments, min_segment_minutes=min_segment_minutes,
        max_sounds_per_segment=max_sounds_per_segment, available_sounds_summary=sounds_summary
    )

    llm_payload: Dict[str, Any] = {"prompt": plan_prompt, "format": "text"}
    if getattr(inputs, "llm_provider", None):
        llm_payload["llm_provider"] = config.llm_provider

    plan_raw = await shinkai_llm_prompt_processor(llm_payload)
    plan_message = plan_raw.get("message", "") if isinstance(plan_raw, dict) else ""
    
    try:
        plan_json = json.loads(plan_message)
        global_theme = str(plan_json.get("global_theme", "")).strip()
        notes = str(plan_json.get("notes", "")).strip()
        plan_segments = plan_json.get("segments", [])
        if not isinstance(plan_segments, list):
             raise ValueError("The 'segments' field in the plan is not a list.")
    except (json.JSONDecodeError, ValueError) as e:
        raise RuntimeError(f"Failed to parse a valid plan from the LLM. Error: {e}. Raw LLM response: '{plan_message}'")

    durations = [_safe_float(s.get("duration_minutes"), total_minutes / max(len(plan_segments), 1)) for s in plan_segments]
    normalized = _normalize_durations(durations, total_minutes, min_segment_minutes)
    for i, d in enumerate(normalized):
        if i < len(plan_segments):
            plan_segments[i]["duration_minutes"] = float(d)

    generated_segments, failed_segments = [], []
    journey_summary_parts, previous_composition_summary = [], ""
    if global_theme: journey_summary_parts.append(f"Global theme: {global_theme}")
    if notes: journey_summary_parts.append(f"Global notes: {notes}")

    print(f"Executing plan with {len(plan_segments)} segments...")
    for idx, seg in enumerate(plan_segments):
        seg_index = seg.get("index", idx + 1)
        title = str(seg.get("title", f"Phase {idx+1}")).strip()
        print(f"--- Generating Segment {seg_index}/{len(plan_segments)}: {title} ---")
        
        base_segment_prompt = f"""
Progressive Ambient Journey — Segment {seg_index} of {len(plan_segments)}: {title}
Context:
- {' | '.join(journey_summary_parts) if journey_summary_parts else "Establish cohesive journey."}
- CONTEXT FROM PREVIOUS SEGMENT'S SOUNDS: {previous_composition_summary or "This is the first segment."}
Instructions for this segment:
- Your goal is: {seg.get("goal", "subtle evolution")}
- Make the change from previous segment subtle and progressive.
- Ensure the last 3–5 seconds are stable for the next segment.
- Keep total active layers within {max_sounds_per_segment} sounds.
- {("Additional guidance: " + str(seg.get("prompt", "")).strip()) if seg.get("prompt") else ""}
User intent reminder: {inputs.request}
""".strip()
        
        max_retries = getattr(config, 'llm_composition_retries', 2)
        total_attempts = max_retries + 1
        last_error = ""
        segment_res = None

        for attempt in range(total_attempts):
            current_prompt = base_segment_prompt
            if last_error:
                print(f"--- Retrying segment {seg_index} (Attempt {attempt + 1}/{total_attempts}) ---")
                feedback = (f"Your previous attempt to generate this segment's composition failed. "
                            f"Please correct the error and try again. Error detail: '{last_error}'. "
                            f"Pay close attention to the required JSON format and only use valid sound IDs from the catalog.")
                current_prompt = f"{feedback}\n\nORIGINAL REQUEST FOR THIS SEGMENT:\n{base_segment_prompt}"
            
            try:
                res = await ambient_sound_composer({
                    "prompt": current_prompt,
                    "duration_minutes": float(seg.get("duration_minutes", 1.0)),
                    "max_sounds": int(max_sounds_per_segment)
                })

                if not isinstance(res, dict) or not res.get("generated_mp3_path"):
                    raise ValueError("Composition tool returned an invalid result or failed to generate an MP3.")
                
                segment_res = res
                break
            except Exception as e:
                last_error = str(e)
                if attempt < total_attempts - 1:
                    print(f"Attempt {attempt + 1} failed for segment {seg_index}: {last_error}")
                else:
                    print(f"ERROR: All {total_attempts} attempts failed for segment {seg_index}. Final error: {last_error}. Skipping.")
                    failed_segments.append({"index": seg_index, "title": title})
                    previous_composition_summary = "Previous segment failed to generate. Try to create a smooth continuation."
        
        if segment_res:
            journey_summary_parts.append(f"{seg_index}. {title}")
            gen_path = segment_res.get("generated_mp3_path", "")
            comp_meta = segment_res.get("composition", {})
            generated_segments.append({
                "index": int(seg_index), "title": title, "duration_minutes": float(seg.get("duration_minutes", 1.0)),
                "prompt": base_segment_prompt, "generated_mp3_path": gen_path, "composition": comp_meta
            })
            sounds_used = comp_meta.get('sounds', [])
            previous_composition_summary = ", ".join([f"{s.get('id', 'unknown')} (vol: {s.get('volume', 0.5):.2f})" for s in sounds_used])

    if not generated_segments:
        output.message = "No segments were generated successfully. No final audio file was created."
        return output

    print("Concatenating generated segments into final audio file...")
    input_files = [g.get("generated_mp3_path", "") for g in generated_segments if g.get("generated_mp3_path")]
    home = await get_home_path()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    final_filename = inputs.output_filename.strip() if inputs.output_filename else f"ambient_journey_{timestamp}.mp3"
    optional_output_path = inputs.optional_output_path if inputs.optional_output_path else home

    concat_res = await mp3_concatenator({
        "input_files": input_files, "output_filename": final_filename, "optional_output_path": optional_output_path
    })
    
    final_path = ""
    if isinstance(concat_res, dict):
        final_path = concat_res.get("home_saved_path", "") or concat_res.get("optional_saved_path", "") or ""

    message = f"Ambient journey generated with {len(generated_segments)} successful segment(s)."
    if failed_segments:
        failed_titles = [f"'{f['title']}' (index {f['index']})" for f in failed_segments]
        message += f" WARNING: {len(failed_segments)} segment(s) failed and were skipped: {', '.join(failed_titles)}."

    # This logic deletes all tracked intermediate files (MP3s and their corresponding JSONs),
    if final_path and not inputs.keep_intermediate_files:
        print("Cleaning up intermediate segment files (MP3s and JSONs)...")
        deleted_count = 0
        intermediate_files_to_delete = []

        # Gather paths of all intermediate files that were successfully created.
        for seg in generated_segments:
            mp3_path = seg.get("generated_mp3_path")
            if mp3_path:
                intermediate_files_to_delete.append(mp3_path)
                # Infer the corresponding JSON file path by swapping the extension.
                base_path, _ = os.path.splitext(mp3_path)
                json_path = base_path + '.json'
                intermediate_files_to_delete.append(json_path)
        
        # Using set() ensures we don't try to delete the same file twice.
        for file_path in set(intermediate_files_to_delete):
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    deleted_count += 1
            except Exception as e:
                print(f"Warning: Could not remove intermediate file '{file_path}'. Error: {e}")
        
        if deleted_count > 0:
            message += f" {deleted_count} intermediate file(s) have been removed."

    output.message = message
    output.global_theme = global_theme
    output.final_mp3_path = final_path

    if inputs.show_composition:
        output.composition_details = generated_segments

    return output