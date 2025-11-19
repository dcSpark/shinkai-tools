# /// script
# dependencies = [
#   "requests",
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
    # prompt: Required string, max 5000 characters
    prompt: str
    # remix_image_path: Required string, local path to image to remix; accepted types: image/jpeg, image/png, image/webp; max size: 10.0MB
    remix_image_path: str
    # character_reference_image_path: Required string, local path to character reference image; accepted types: image/jpeg, image/png, image/webp; max size: 10.0MB
    character_reference_image_path: str
    # rendering_speed: Optional string, must be one of 'TURBO', 'BALANCED', 'QUALITY'; defaults to 'BALANCED'
    rendering_speed: Optional[str] = None
    # style: Optional string, must be one of 'AUTO', 'REALISTIC', 'FICTION'; defaults to 'AUTO'
    style: Optional[str] = None
    # expand_prompt: Optional boolean, defaults to True (always included in payload)
    expand_prompt: Optional[bool] = None
    # image_size: Optional string, must be one of 'square', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'; defaults to 'square_hd'
    image_size: Optional[str] = None
    # num_images: Optional integer, must be 1-4; defaults to 1 (always included in payload)
    num_images: Optional[int] = 1
    # seed: Optional integer for random seed to control generation; defaults to None (omit if not provided)
    seed: Optional[int] = None
    # negative_prompt: Optional string, max 500 characters; defaults to '' (always included in payload)
    negative_prompt: Optional[str] = None
    # strength: Optional float, strength of the input image in the remix; min 0.1, max 1.0; defaults to 0.8
    strength: Optional[float] = None
    # filename: Optional string for base filename (without extension); defaults to None (uses task_id)
    filename: Optional[str] = None

class OUTPUT:
    temporary_image_urls: List[str]
    task_id: str
    saved_images_paths: List[str]
    status: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    # Normalize empty strings to None for optional fields to handle blank inputs
    if inputs.prompt == "":
        inputs.prompt = None
    if inputs.rendering_speed == "":
        inputs.rendering_speed = None
    if inputs.style == "":
        inputs.style = None
    if inputs.image_size == "":
        inputs.image_size = None
    if inputs.negative_prompt == "":
        inputs.negative_prompt = None
    if inputs.filename == "":
        inputs.filename = None
    if inputs.remix_image_path == "":
        inputs.remix_image_path = None
    if inputs.character_reference_image_path == "":
        inputs.character_reference_image_path = None

    output = OUTPUT()
    output.temporary_image_urls = []
    output.task_id = ""
    output.saved_images_paths = []
    output.status = "error: unknown"

    try:
        # Validate remix_image_path
        if inputs.remix_image_path is None:
            output.status = "error: remix_image_path is required"
            return output
        remix_path = inputs.remix_image_path.strip()
        if not remix_path:
            output.status = "error: remix_image_path cannot be empty"
            return output
        if not os.path.exists(remix_path) or not os.path.isfile(remix_path):
            output.status = f"error: Invalid path or not a file: {remix_path}"
            return output
        remix_file_size = os.path.getsize(remix_path)
        if remix_file_size > 10 * 1024 * 1024:
            output.status = f"error: Remix image file too large: {remix_file_size} bytes, max 10MB"
            return output
        remix_ext = os.path.splitext(remix_path.lower())[1]
        allowed_exts = ['.jpg', '.jpeg', '.png', '.webp']
        if remix_ext not in allowed_exts:
            output.status = f"error: Unsupported file extension {remix_ext} for remix image; must be one of {allowed_exts}"
            return output

        # Validate character_reference_image_path
        if inputs.character_reference_image_path is None:
            output.status = "error: character_reference_image_path is required"
            return output
        ref_path = inputs.character_reference_image_path.strip()
        if not ref_path:
            output.status = "error: character_reference_image_path cannot be empty"
            return output
        if not os.path.exists(ref_path) or not os.path.isfile(ref_path):
            output.status = f"error: Invalid path or not a file: {ref_path}"
            return output
        ref_file_size = os.path.getsize(ref_path)
        if ref_file_size > 10 * 1024 * 1024:
            output.status = f"error: Reference image file too large: {ref_file_size} bytes, max 10MB"
            return output
        ref_ext = os.path.splitext(ref_path.lower())[1]
        if ref_ext not in allowed_exts:
            output.status = f"error: Unsupported file extension {ref_ext} for reference image; must be one of {allowed_exts}"
            return output

        # Set defaults for rendering_speed and style (case insensitive)
        effective_rendering_speed = inputs.rendering_speed.upper() if inputs.rendering_speed is not None else "BALANCED"
        effective_style = inputs.style.upper() if inputs.style is not None else "AUTO"

        # Validate prompt length
        if inputs.prompt is None or len(inputs.prompt.strip()) == 0 or len(inputs.prompt) > 5000:
            output.status = "error: prompt must be non-empty and max 5000 characters"
            return output

        # Validate rendering_speed
        allowed_speeds = ["TURBO", "BALANCED", "QUALITY"]
        if effective_rendering_speed not in allowed_speeds:
            output.status = f"error: rendering_speed must be one of {allowed_speeds}"
            return output

        # Validate style
        allowed_styles = ["AUTO", "REALISTIC", "FICTION"]
        if effective_style not in allowed_styles:
            output.status = f"error: style must be one of {allowed_styles}"
            return output

        # Validate image_size
        allowed_sizes = ["square", "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"]
        effective_image_size = inputs.image_size if inputs.image_size is not None else "square_hd"
        if effective_image_size not in allowed_sizes:
            output.status = f"error: image_size must be one of {allowed_sizes}"
            return output

        # Validate num_images
        effective_num_images = inputs.num_images if inputs.num_images is not None else 1
        if not (1 <= effective_num_images <= 4):
            output.status = "error: num_images must be integer 1-4 (default 1)"
            return output

        # Validate negative_prompt length
        effective_negative_prompt = inputs.negative_prompt if inputs.negative_prompt is not None else ""
        if len(effective_negative_prompt) > 500:
            output.status = "error: negative_prompt must be max 500 characters"
            return output

        # Validate expand_prompt
        effective_expand_prompt = inputs.expand_prompt if inputs.expand_prompt is not None else True

        # Validate strength
        if inputs.strength is not None:
            if not (0.1 <= inputs.strength <= 1.0):
                output.status = "error: strength must be between 0.1 and 1.0"
                return output
        effective_strength = inputs.strength if inputs.strength is not None else 0.8

        # Upload remix image to get URL
        upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
        upload_path = "images/user-uploads"
        auth_header = {"Authorization": f"Bearer {config.api_key}"}
        remix_basename = os.path.basename(remix_path)
        remix_mime_type, _ = mimetypes.guess_type(remix_path)
        if remix_mime_type is None:
            remix_mime_type = "application/octet-stream"
        try:
            with open(remix_path, 'rb') as f:
                files = {'file': (remix_basename, f, remix_mime_type)}
                data = {
                    'uploadPath': upload_path,
                    'fileName': remix_basename
                }
                upload_response = requests.post(upload_base_url, data=data, files=files, headers=auth_header)
            if upload_response.status_code != 200:
                output.status = f"error: HTTP {upload_response.status_code} uploading remix image {remix_path} - {upload_response.text[:200]}"
                return output
            try:
                upload_result = upload_response.json()
            except json.JSONDecodeError:
                output.status = f"error: Invalid JSON response uploading remix image {remix_path} - {upload_response.text[:200]}"
                return output
            if not upload_result.get("success") or upload_result.get("code") != 200:
                msg = upload_result.get("msg", "Unknown error")
                code = upload_result.get("code", "unknown")
                output.status = f"error: Upload failed for remix image {remix_path} - code {code}, msg: {msg}"
                return output
            remix_url = upload_result.get("data", {}).get("downloadUrl")
            if not remix_url:
                output.status = f"error: No download URL returned for remix image {remix_path}"
                return output
        except Exception as upload_e:
            output.status = f"error: Exception uploading remix image {remix_path} - {str(upload_e)}"
            return output

        # Upload reference image to get URL
        ref_basename = os.path.basename(ref_path)
        ref_mime_type, _ = mimetypes.guess_type(ref_path)
        if ref_mime_type is None:
            ref_mime_type = "application/octet-stream"
        try:
            with open(ref_path, 'rb') as f:
                files = {'file': (ref_basename, f, ref_mime_type)}
                data = {
                    'uploadPath': upload_path,
                    'fileName': ref_basename
                }
                upload_response = requests.post(upload_base_url, data=data, files=files, headers=auth_header)
            if upload_response.status_code != 200:
                output.status = f"error: HTTP {upload_response.status_code} uploading reference image {ref_path} - {upload_response.text[:200]}"
                return output
            try:
                upload_result = upload_response.json()
            except json.JSONDecodeError:
                output.status = f"error: Invalid JSON response uploading reference image {ref_path} - {upload_response.text[:200]}"
                return output
            if not upload_result.get("success") or upload_result.get("code") != 200:
                msg = upload_result.get("msg", "Unknown error")
                code = upload_result.get("code", "unknown")
                output.status = f"error: Upload failed for reference image {ref_path} - code {code}, msg: {msg}"
                return output
            ref_url = upload_result.get("data", {}).get("downloadUrl")
            if not ref_url:
                output.status = f"error: No download URL returned for reference image {ref_path}"
                return output
        except Exception as upload_e:
            output.status = f"error: Exception uploading reference image {ref_path} - {str(upload_e)}"
            return output

        model = "ideogram/character-remix"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task
        create_url = f"{base_url}/createTask"
        input_dict = {
            "prompt": inputs.prompt.strip(),
            "image_url": remix_url,
            "reference_image_urls": [ref_url],
            "rendering_speed": effective_rendering_speed,
            "style": effective_style,
            "expand_prompt": effective_expand_prompt,
            "num_images": str(effective_num_images),
            "image_size": effective_image_size,
            "negative_prompt": effective_negative_prompt,
            "strength": effective_strength
        }
        if inputs.seed is not None:
            input_dict["seed"] = inputs.seed

        payload = {
            "model": model,
            "input": input_dict
        }

        response = requests.post(create_url, headers=headers, json=payload)
        if response.status_code != 200:
            result = response.json() if response.text else {}
            output.status = f"error: Failed to create task - HTTP {response.status_code} {result.get('message', 'Unknown error')}"
            return output
        result = response.json()
        if result.get("code") != 200:
            output.status = f"error: Failed to create task - {result.get('message', 'Unknown error')}"
            return output

        task_id = result["data"]["taskId"]
        output.task_id = task_id

        # Poll for completion
        query_url = "https://api.kie.ai/api/v1/jobs/recordInfo"
        start_time = time.time()
        poll_success = False

        while time.time() - start_time < (config.max_duration or 300):
            qresponse = requests.get(query_url, headers={"Authorization": f"Bearer {config.api_key}"}, params={"taskId": task_id})
            if qresponse.status_code != 200:
                qresult = qresponse.json() if qresponse.text else {}
                output.status = f"error: Failed to query task - HTTP {qresponse.status_code} {qresult.get('message', 'Unknown error')}"
                return output
            qresult = qresponse.json()
            if qresult.get("code") != 200:
                output.status = f"error: Failed to query task - {qresult.get('message', 'Unknown error')}"
                return output

            data = qresult["data"]
            state = data.get("state")
            if state == "success":
                result_json_str = data.get("resultJson", "{}")
                result_json = json.loads(result_json_str)
                image_urls = result_json.get("resultUrls", [])
                output.temporary_image_urls = image_urls

                # Download and save all images if available
                download_success = True
                if image_urls:
                    home_path = await get_home_path()
                    local_paths = []
                    ext = "png"
                    base_filename = inputs.filename if inputs.filename is not None else task_id
                    # Sanitize base_filename to remove extension if present
                    if '.' in base_filename:
                        base_filename = os.path.splitext(base_filename)[0]
                    for i, download_url in enumerate(image_urls, start=1):
                        filename = f"{base_filename}_{i}.{ext}"
                        local_path = os.path.join(home_path, filename)
                        try:
                            dl_response = requests.get(download_url, stream=True)
                            dl_response.raise_for_status()
                            with open(local_path, 'wb') as f:
                                for chunk in dl_response.iter_content(chunk_size=8192):
                                    f.write(chunk)
                            local_paths.append(local_path)
                        except Exception as dl_e:
                            download_success = False
                            output.status = f"partial_success: Failed to download image {i} - {str(dl_e)}"
                            # Continue downloading others, but set status to indicate partial
                    output.saved_images_paths = local_paths
                else:
                    output.status = "success: No images generated"

                if download_success and image_urls:
                    output.status = "success"
                poll_success = True
                break
            elif state == "fail":
                fail_msg = data.get("failMsg", "Unknown failure")
                output.status = f"error: Task failed - {fail_msg}"
                return output
            elif state not in ["waiting", "queuing", "generating"]:
                output.status = f"error: Unexpected task state - {state}"
                return output

            time.sleep(config.polling_interval or 5)

        if not poll_success:
            output.status = f"error: Task timed out after {config.max_duration or 300} seconds"
            return output

    except Exception as e:
        output.status = f"error: {str(e)}"
        return output

    return output