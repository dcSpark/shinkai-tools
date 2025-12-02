# /// script
# dependencies = [
# "requests",
# ]
# ///

from typing import List, Optional
import requests
import json
import time
import os
import mimetypes
from shinkai_local_support import get_home_path

class CONFIG:
    # api_key: Required string for kie.ai API authentication
    api_key: str
    # polling_interval: Optional integer for seconds between status polls, defaults to 5
    polling_interval: Optional[int] = 5
    # max_duration: Optional integer for maximum wait time in seconds, defaults to 300
    max_duration: Optional[int] = 300

class INPUTS:
    # prompt: Required string describing the desired video content, max 5000 characters
    prompt: str
    # image_paths: List of 0-2 local paths to input images; auto-determines generation mode if generation_type=None.
    # Supported formats: .jpg, .jpeg, .png, .webp; max size 10MB each.
    # Auto: 0 images -> TEXT_TO_VIDEO; 1 image -> REFERENCE_TO_VIDEO; 2 images -> FIRST_AND_LAST_FRAMES_TO_VIDEO
    image_paths: List[str]
    # model: str, one of 'veo3', 'veo3_fast'; default 'veo3_fast'
    model: str = "veo3_fast"
    # generation_type: Optional[str], None for auto, else one of 'TEXT_TO_VIDEO', 'FIRST_AND_LAST_FRAMES_TO_VIDEO', 'REFERENCE_TO_VIDEO'
    # Case insensitive; works with spaces, missing '_', '-', e.g. 'text to video', 'texttovideo', 'referenceToVideo', 'reference-to-video'
    generation_type: Optional[str] = None
    # aspect_ratio: str, one of '16:9', '9:16', 'Auto'; default '16:9'
    aspect_ratio: str = "16:9"
    # seed: Optional[int] between 10000-99999 for reproducible generations
    seed: Optional[int] = None
    # enable_translation: bool, automatically translate prompt to English; default False
    enable_translation: bool = False
    # watermark: Optional[str] text to overlay as watermark on video
    watermark: Optional[str] = None
    # filename: Optional[str] base filename (without extension) for downloaded video; defaults to task_id
    filename: Optional[str] = None

class OUTPUT:
    video_urls: List[str]
    task_id: str
    local_path: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.video_urls = []
    output.task_id = ""
    output.local_path = ""

    # Input validation
    if not inputs.prompt or not inputs.prompt.strip():
        raise ValueError("prompt must not be empty")
    if len(inputs.prompt) > 5000:
        raise ValueError("prompt must be max 5000 characters")

    allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
    allowed_models = {"veo3", "veo3_fast"}
    allowed_aspects = {"16:9", "9:16", "Auto"}
    allowed_gts = {"TEXT_TO_VIDEO", "FIRST_AND_LAST_FRAMES_TO_VIDEO", "REFERENCE_TO_VIDEO"}

    if inputs.model not in allowed_models:
        raise ValueError(f"model must be one of {allowed_models}")
    if inputs.aspect_ratio not in allowed_aspects:
        raise ValueError(f"aspect_ratio must be one of {allowed_aspects}")

    num_images = len(inputs.image_paths)
    if num_images > 2:
        raise ValueError("image_paths must contain at most 2 paths")

    # Validate image files
    validated_paths = []
    for i, path in enumerate(inputs.image_paths):
        path = path.strip()
        if not path:
            raise ValueError(f"image_paths[{i}] must not be empty")
        if not os.path.exists(path) or not os.path.isfile(path):
            raise ValueError(f"Invalid path or not a file (image {i+1}): {path}")
        _, ext = os.path.splitext(path.lower())
        if ext not in allowed_extensions:
            raise ValueError(f"Unsupported extension for image {i+1} ({path}); must be .jpg, .jpeg, .png, .webp")
        file_size = os.path.getsize(path)
        if file_size > 10 * 1024 * 1024:
            raise ValueError(f"Image {i+1} too large ({path}: {file_size / (1024*1024):.1f} MB > 10.0 MB)")
        validated_paths.append(path)
    inputs.image_paths = validated_paths

    # Validate seed
    if inputs.seed is not None and not (10000 <= inputs.seed <= 99999):
        raise ValueError("seed must be an integer between 10000 and 99999 if provided")

    # Normalize and determine generation_type
    gt = None
    gt_input = (inputs.generation_type or "").strip().upper()
    if gt_input:
        # Replace common separators with '_'
        gt_candidate = gt_input.replace(" ", "_").replace("-", "_")
        # Map concatenated/missing '_' forms
        no_underscore_map = {
            "TEXTTOVIDEO": "TEXT_TO_VIDEO",
            "REFERENCETOVIDEO": "REFERENCE_TO_VIDEO",
            "FIRSTANDLASTFRAMESTOVIDEO": "FIRST_AND_LAST_FRAMES_TO_VIDEO",
            "FIRST_AND_LAST_FRAMES_TO_VIDEO": "FIRST_AND_LAST_FRAMES_TO_VIDEO",
        }
        gt_candidate = no_underscore_map.get(gt_candidate, gt_candidate)
        if gt_candidate not in allowed_gts:
            raise ValueError(f"Invalid generation_type '{inputs.generation_type}'. Expected one of {list(allowed_gts)} (case insensitive, works with spaces, missing '_', '-', e.g. 'text to video', 'texttovideo')")
        gt = gt_candidate
    else:
        # Auto-detect
        num_images = len(inputs.image_paths)
        if num_images == 0:
            gt = "TEXT_TO_VIDEO"
        elif num_images == 1:
            gt = "REFERENCE_TO_VIDEO"
        elif num_images == 2:
            gt = "FIRST_AND_LAST_FRAMES_TO_VIDEO"

    # Strict validation for explicit or auto gt
    num_images = len(inputs.image_paths)
    if gt == "TEXT_TO_VIDEO" and num_images != 0:
        raise ValueError("TEXT_TO_VIDEO requires 0 images")
    elif gt == "FIRST_AND_LAST_FRAMES_TO_VIDEO" and num_images != 2:
        raise ValueError("FIRST_AND_LAST_FRAMES_TO_VIDEO requires exactly 2 images")
    elif gt == "REFERENCE_TO_VIDEO" and num_images != 1:
        raise ValueError("REFERENCE_TO_VIDEO requires exactly 1 image")
    if gt == "REFERENCE_TO_VIDEO":
        if inputs.model != "veo3_fast":
            raise ValueError("REFERENCE_TO_VIDEO requires model='veo3_fast'")
        if inputs.aspect_ratio != "16:9":
            raise ValueError("REFERENCE_TO_VIDEO requires aspect_ratio='16:9'")

    # Upload images if any
    upload_urls: List[str] = []
    if inputs.image_paths:
        upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
        upload_path = "images/user-uploads"
        auth_header = {"Authorization": f"Bearer {config.api_key}"}
        for idx, image_path in enumerate(inputs.image_paths):
            basename = os.path.basename(image_path)
            mime_type, _ = mimetypes.guess_type(image_path)
            if mime_type is None:
                mime_type = "application/octet-stream"
            try:
                with open(image_path, 'rb') as f:
                    files = {'file': (basename, f, mime_type)}
                    data = {
                        'uploadPath': upload_path,
                        'fileName': basename
                    }
                    upload_response = requests.post(upload_base_url, data=data, files=files, headers=auth_header)
                if upload_response.status_code != 200:
                    raise ValueError(f"HTTP {upload_response.status_code} uploading image {idx+1} ({image_path}) - {upload_response.text[:200]}")
                try:
                    upload_result = upload_response.json()
                except json.JSONDecodeError:
                    raise ValueError(f"Invalid JSON response uploading image {idx+1} ({image_path}) - {upload_response.text[:200]}")
                if not upload_result.get("success") or upload_result.get("code") != 200:
                    msg = upload_result.get("msg", "Unknown error")
                    code = upload_result.get("code", "unknown")
                    raise ValueError(f"Upload failed for image {idx+1} ({image_path}) - code {code}, msg: {msg}")
                download_url = upload_result.get("data", {}).get("downloadUrl")
                if not download_url:
                    raise ValueError(f"No download URL for image {idx+1} ({image_path})")
                upload_urls.append(download_url)
            except Exception as upload_e:
                raise ValueError(f"Exception uploading image {idx+1} ({image_path}) - {str(upload_e)}")

    # Create task
    base_url = "https://api.kie.ai/api/v1/veo"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.api_key}"
    }
    create_url = f"{base_url}/generate"
    payload = {
        "prompt": inputs.prompt,
        "model": inputs.model,
        "aspectRatio": inputs.aspect_ratio,
        "generationType": gt,
        "enableTranslation": inputs.enable_translation,
        "imageUrls": upload_urls
    }
    if inputs.seed is not None:
        payload["seeds"] = inputs.seed
    if inputs.watermark:
        payload["watermark"] = inputs.watermark

    response = requests.post(create_url, headers=headers, json=payload)
    if response.status_code != 200:
        try:
            result = response.json()
        except json.JSONDecodeError:
            result = {"msg": response.text[:200]}
        raise ValueError(f"Failed to create task HTTP {response.status_code}: {result.get('msg', 'Unknown error')}")
    try:
        result = response.json()
    except json.JSONDecodeError:
        raise ValueError(f"Invalid JSON create response: {response.text[:200]}")
    if result.get("code") != 200:
        raise ValueError(f"Failed to create task: code {result.get('code')}, {result.get('msg', 'Unknown error')}")

    task_id = result["data"]["taskId"]
    output.task_id = task_id

    # Poll for completion
    query_url = f"{base_url}/record-info"
    start_time = time.time()
    poll_interval = config.polling_interval or 5
    max_duration = config.max_duration or 300

    while time.time() - start_time < max_duration:
        qresponse = requests.get(
            query_url,
            headers={"Authorization": f"Bearer {config.api_key}"},
            params={"taskId": task_id}
        )
        if qresponse.status_code != 200:
            try:
                qresult = qresponse.json()
                raise ValueError(f"Query failed HTTP {qresponse.status_code}: code {qresult.get('code')}, msg {qresult.get('msg', qresponse.text[:200])}")
            except json.JSONDecodeError:
                raise ValueError(f"Query HTTP {qresponse.status_code}: {qresponse.text[:200]}")
        try:
            qresult = qresponse.json()
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON query response: {qresponse.text[:200]}")
        if qresult.get("code") != 200:
            raise ValueError(f"Query code {qresult.get('code')}: {qresult.get('msg', 'Unknown error')}")

        data = qresult.get("data")
        if not data:
            time.sleep(poll_interval)
            continue

        success_flag = int(data.get("successFlag", 0))
        if success_flag == 1:
            response_data = data.get("response", {})
            video_urls = response_data.get("resultUrls", [])
            output.video_urls = video_urls

            # Download first video if available
            if video_urls:
                home_path = await get_home_path()
                if inputs.filename and inputs.filename.strip():
                    base_name = inputs.filename.strip()
                    filename = f"{base_name}.mp4"
                else:
                    filename = f"{task_id}.mp4"
                local_path = os.path.join(home_path, filename)
                download_url = video_urls[0]
                try:
                    dl_response = requests.get(download_url, stream=True)
                    dl_response.raise_for_status()
                    with open(local_path, 'wb') as f:
                        for chunk in dl_response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    output.local_path = local_path
                except Exception as dl_e:
                    raise ValueError(f"Failed to download and save video: {str(dl_e)}")
            return output
        elif success_flag in (2, 3):
            error_msg = data.get("errorMessage", "")
            error_code = data.get("errorCode")
            msg = f"Task failed (successFlag={success_flag})"
            if error_msg:
                msg += f": {error_msg}"
            if error_code:
                msg += f" (errorCode={error_code})"
            raise ValueError(msg)

        time.sleep(poll_interval)

    raise TimeoutError(f"Task {task_id} timed out after {max_duration} seconds")