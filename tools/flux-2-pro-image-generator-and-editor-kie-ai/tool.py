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
    # default_aspect_ratio: Optional string, default aspect ratio if input.aspect_ratio not provided; one of '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', 'reference' (case insensitive); defaults to '4:3'
    default_aspect_ratio: Optional[str] = "4:3"

class INPUTS:
    # prompt: Required string, must be between 3 and 5000 characters
    prompt: str
    # input_image_paths: Optional list of strings, local paths to 1-8 reference input images for image-to-image; accepted types: image/jpeg, image/png, image/webp; max 10MB per file. Omit for text-to-image.
    input_image_paths: Optional[List[str]] = None
    # aspect_ratio: Optional string override to config.default_aspect_ratio; one of '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', 'reference' (case insensitive); 'reference' requires input images; defaults to config.default_aspect_ratio ('4:3')
    aspect_ratio: Optional[str] = None
    # resolution: Optional string, must be '1K' or '2K' (case insensitive); defaults to '1K'
    resolution: Optional[str] = "1K"
    # filename: Optional string for base filename (without extension), defaults to None (uses task_id)
    filename: Optional[str] = None

class OUTPUT:
    temporary_image_url: str
    task_id: str
    saved_image_path: str
    status: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.temporary_image_url = ""
    output.task_id = ""
    output.saved_image_path = ""
    output.status = "error: unknown"

    try:
        # Validate prompt length
        if not (3 <= len(inputs.prompt) <= 5000):
            output.status = "error: prompt must be between 3 and 5000 characters"
            return output

        # Determine mode based on input_image_paths
        image_paths = inputs.input_image_paths or []
        if image_paths:
            if not isinstance(image_paths, list) or not (1 <= len(image_paths) <= 8):
                output.status = "error: input_image_paths must be a list with 1 to 8 paths for image-to-image"
                return output
            mode = "image-to-image"
        else:
            mode = "text-to-image"

        # Handle and validate input_image_paths if provided
        upload_urls = []
        if image_paths:
            allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
            MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
            upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
            upload_path = "images/user-uploads"
            auth_header = {"Authorization": f"Bearer {config.api_key}"}

            for path in image_paths:
                if not os.path.exists(path) or not os.path.isfile(path):
                    output.status = f"error: Invalid path or not a file: {path}"
                    return output

                file_size = os.path.getsize(path)
                if file_size > MAX_FILE_SIZE:
                    output.status = f"error: File too large {path}: {file_size / (1024*1024):.1f}MB > 10MB"
                    return output

                _, ext = os.path.splitext(path.lower())
                if ext not in allowed_extensions:
                    output.status = f"error: Unsupported file extension for {path}; must be .jpg, .jpeg, .png, or .webp"
                    return output

                # Upload file to get URL
                basename = os.path.basename(path)
                mime_type, _ = mimetypes.guess_type(path)
                if mime_type is None:
                    mime_type = "application/octet-stream"
                try:
                    with open(path, 'rb') as f:
                        files = {'file': (basename, f, mime_type)}
                        data = {'uploadPath': upload_path, 'fileName': basename}
                        upload_response = requests.post(upload_base_url, data=data, files=files, headers=auth_header)
                        if upload_response.status_code != 200:
                            output.status = f"error: HTTP {upload_response.status_code} uploading {path} - {upload_response.text[:200]}"
                            return output
                        try:
                            upload_result = upload_response.json()
                        except json.JSONDecodeError:
                            output.status = f"error: Invalid JSON response uploading {path} - {upload_response.text[:200]}"
                            return output
                        if not upload_result.get("success") or upload_result.get("code") != 200:
                            msg = upload_result.get("msg", "Unknown error")
                            code = upload_result.get("code", "unknown")
                            output.status = f"error: Upload failed for {path} - code {code}, msg: {msg}"
                            return output
                        download_url = upload_result.get("data", {}).get("downloadUrl")
                        if not download_url:
                            output.status = f"error: No download URL returned for {path}"
                            return output
                        upload_urls.append(download_url)
                except Exception as upload_e:
                    output.status = f"error: Exception uploading {path} - {str(upload_e)}"
                    return output

        # Determine and validate aspect_ratio: override or default, case insensitive
        allowed_aspects = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "reference"]
        ar_input = str(inputs.aspect_ratio or config.default_aspect_ratio or "4:3").strip().lower()
        if ar_input not in [a.lower() for a in allowed_aspects]:
            output.status = f"error: aspect_ratio must be one of {allowed_aspects} (case insensitive); using {config.default_aspect_ratio or '4:3'}"
            return output
        aspect_to_use = next(a for a in allowed_aspects if a.lower() == ar_input)
        if aspect_to_use == "reference" and mode == "text-to-image":
            output.status = "error: 'reference' aspect_ratio requires input images (reference images)"
            return output

        # Map 'reference' to 'auto' for API
        api_aspect_ratio = "auto" if aspect_to_use == "reference" else aspect_to_use

        # Validate resolution case insensitive, normalize to uppercase for API
        allowed_resolutions = ["1K", "2K"]
        res_input = str(inputs.resolution or "1K").strip().upper()
        if res_input not in allowed_resolutions:
            output.status = f"error: resolution must be one of {allowed_resolutions} (case insensitive, default '1K')"
            return output
        res_to_use = res_input

        # Prepare model (Pro only) and payload
        full_model = f"flux-2/pro-{mode}"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        input_payload = {
            "prompt": inputs.prompt,
            "aspect_ratio": api_aspect_ratio,
            "resolution": res_to_use
        }
        if upload_urls:
            input_payload["input_urls"] = upload_urls

        # Create task
        create_url = f"{base_url}/createTask"
        payload = {"model": full_model, "input": input_payload}
        response = requests.post(create_url, headers=headers, json=payload)
        if response.status_code != 200:
            try:
                result = response.json()
                err_msg = result.get("message", result.get("msg", "Unknown error"))
            except json.JSONDecodeError:
                err_msg = response.text[:200]
            output.status = f"error: Failed to create task HTTP {response.status_code} - {err_msg}"
            return output
        try:
            result = response.json()
        except json.JSONDecodeError:
            output.status = f"error: Invalid JSON response creating task - {response.text[:200]}"
            return output
        if result.get("code") != 200:
            output.status = f"error: Failed to create task - {result.get('message', result.get('msg', 'Unknown error'))}"
            return output

        task_id = result["data"]["taskId"]
        output.task_id = task_id

        # Poll for completion
        query_url = "https://api.kie.ai/api/v1/jobs/recordInfo"
        start_time = time.time()
        polling_interval = config.polling_interval or 5
        max_duration = config.max_duration or 300

        while time.time() - start_time < max_duration:
            qresponse = requests.get(query_url, headers={"Authorization": f"Bearer {config.api_key}"}, params={"taskId": task_id})
            if qresponse.status_code != 200:
                try:
                    qresult = qresponse.json()
                    err_msg = qresult.get("message", qresult.get("msg", "Unknown error"))
                except json.JSONDecodeError:
                    err_msg = qresponse.text[:200]
                output.status = f"error: Failed to query task HTTP {qresponse.status_code} - {err_msg}"
                return output
            try:
                qresult = qresponse.json()
            except json.JSONDecodeError:
                output.status = f"error: Invalid JSON response querying task - {qresponse.text[:200]}"
                return output
            if qresult.get("code") != 200:
                output.status = f"error: Failed to query task - {qresult.get('message', qresult.get('msg', 'Unknown error'))}"
                return output

            data = qresult["data"]
            state = data.get("state")
            if state == "success":
                result_json_str = data.get("resultJson", "{}")
                try:
                    result_json = json.loads(result_json_str)
                except json.JSONDecodeError:
                    result_json = {}
                image_urls = result_json.get("resultUrls", [])
                output.temporary_image_url = image_urls[0] if image_urls else ""

                # Download and save the first image if available (PNG)
                if image_urls:
                    home_path = await get_home_path()
                    ext = "png"
                    base_name = (inputs.filename or task_id).rsplit('.', 1)[0]  # Sanitize: remove extension if present
                    filename = f"{base_name}.{ext}"
                    local_path = os.path.join(home_path, filename)
                    try:
                        dl_response = requests.get(image_urls[0], stream=True)
                        dl_response.raise_for_status()
                        with open(local_path, 'wb') as f:
                            for chunk in dl_response.iter_content(chunk_size=8192):
                                f.write(chunk)
                        output.saved_image_path = local_path
                        output.status = "success"
                    except Exception as dl_e:
                        output.status = f"partial_success: Failed to download image - {str(dl_e)}"
                        output.saved_image_path = ""
                else:
                    output.status = "success: No images generated"
                    output.saved_image_path = ""
                return output
            elif state == "fail":
                fail_msg = data.get("failMsg") or data.get("message", "Unknown failure")
                output.status = f"error: Task failed - {fail_msg}"
                return output
            elif state not in ["waiting", "queuing", "generating"]:
                output.status = f"error: Unexpected task state - {state}"
                return output

            time.sleep(polling_interval)

        output.status = f"error: Task timed out after {max_duration} seconds"
        return output

    except Exception as e:
        output.status = f"error: Unexpected exception - {str(e)}"
        return output