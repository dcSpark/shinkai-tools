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
    # prompt: Required string, max 5000 characters, describing the desired video motion
    prompt: str
    # input_image_path: Required string, local path to input image for video generation; accepted types: image/jpeg, image/png, image/webp; max size: 10.0MB
    input_image_path: str
    # mode: Optional string, one of 'fun', 'normal', 'spicy' (spicy auto-switches to normal for external images). Default: 'normal'
    mode: Optional[str] = "normal"
    # filename: Optional string for base filename (without extension), defaults to None (uses task_id)
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

    # Validate inputs
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
    allowed_modes = {"fun", "normal", "spicy"}

    image_path = inputs.input_image_path.strip()
    if not image_path:
        raise ValueError("input_image_path must not be empty")
    if not os.path.exists(image_path) or not os.path.isfile(image_path):
        raise ValueError(f"Invalid path or not a file: {image_path}")
    _, ext = os.path.splitext(image_path.lower())
    if ext not in allowed_extensions:
        raise ValueError(f"Unsupported file extension for {image_path}; must be .jpg, .jpeg, .png, or .webp")
    file_size = os.path.getsize(image_path)
    if file_size > 10 * 1024 * 1024:
        raise ValueError(f"Image file too large: {image_path} ({file_size / (1024*1024):.1f} MB > 10.0 MB)")
    if len(inputs.prompt) > 5000:
        raise ValueError("prompt must be max 5000 characters")
    effective_mode = inputs.mode or "normal"
    if effective_mode not in allowed_modes:
        raise ValueError(f"mode must be one of {allowed_modes}")

    # Upload image
    upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
    upload_path = "images/user-uploads"
    auth_header = {"Authorization": f"Bearer {config.api_key}"}
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
            raise ValueError(f"HTTP {upload_response.status_code} uploading {image_path} - {upload_response.text[:200]}")
        try:
            upload_result = upload_response.json()
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON response uploading {image_path} - {upload_response.text[:200]}")
        if not upload_result.get("success") or upload_result.get("code") != 200:
            msg = upload_result.get("msg", "Unknown error")
            code = upload_result.get("code", "unknown")
            raise ValueError(f"Upload failed for {image_path} - code {code}, msg: {msg}")
        download_url = upload_result.get("data", {}).get("downloadUrl")
        if not download_url:
            raise ValueError(f"No download URL returned for {image_path}")
        upload_urls = [download_url]
    except Exception as upload_e:
        raise ValueError(f"Exception uploading {image_path} - {str(upload_e)}")

    # Create task
    base_url = "https://api.kie.ai/api/v1/jobs"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.api_key}"
    }
    create_url = f"{base_url}/createTask"
    payload = {
        "model": "grok-imagine/image-to-video",
        "input": {
            "image_urls": upload_urls,
            "prompt": inputs.prompt,
            "mode": effective_mode
        }
    }
    response = requests.post(create_url, headers=headers, json=payload)
    result = response.json()
    if result.get("code") != 200:
        raise ValueError(f"Failed to create task: {result.get('message', 'Unknown error')}")

    task_id = result["data"]["taskId"]
    output.task_id = task_id

    # Poll for completion
    query_url = "https://api.kie.ai/api/v1/jobs/recordInfo"
    start_time = time.time()

    while time.time() - start_time < (config.max_duration or 300):
        qresponse = requests.get(
            query_url,
            headers={"Authorization": f"Bearer {config.api_key}"},
            params={"taskId": task_id}
        )
        qresult = qresponse.json()
        if qresult.get("code") != 200:
            raise ValueError(f"Failed to query task: {qresult.get('message', 'Unknown error')}")

        data = qresult["data"]
        state = data.get("state")
        if state == "success":
            result_json_str = data.get("resultJson", "{}")
            result_json = json.loads(result_json_str)
            video_urls = result_json.get("resultUrls", [])
            output.video_urls = video_urls

            # Download and save first video if available
            if video_urls:
                home_path = await get_home_path()
                # Determine filename: use sanitized input filename or task_id
                if inputs.filename and inputs.filename.strip():
                    base_name = os.path.splitext(inputs.filename)[0]
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
                except Exception as e:
                    raise ValueError(f"Failed to download and save video: {str(e)}")

            return output
        elif state == "fail":
            fail_msg = data.get("failMsg", "Unknown failure")
            raise ValueError(f"Task failed: {fail_msg}")
        elif state not in ["waiting", "queuing", "generating"]:
            raise ValueError(f"Unexpected task state: {state}")

        time.sleep(config.polling_interval or 5)

    raise TimeoutError(f"Task timed out after {config.max_duration or 300} seconds")