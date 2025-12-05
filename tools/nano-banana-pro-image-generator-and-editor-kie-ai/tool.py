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
    # input_image_paths: Optional list of strings, local paths to input images for editing/guidance/combining, up to 8; accepted types: image/jpeg, image/png, image/webp; max 30MB per file
    input_image_paths: Optional[List[str]] = None
    # aspect_ratio: Optional string, 'auto'/empty/None omits from API (uses API default), else one of '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'; defaults to 'auto'
    aspect_ratio: Optional[str] = "auto"
    # resolution: Optional string, must be one of '1K', '2K', '4K'; defaults to '2K'
    resolution: Optional[str] = "2K"
    # output_format: Optional string, must be 'png' or 'jpg'; defaults to 'png'
    output_format: Optional[str] = "png"
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
        if len(inputs.prompt) > 5000:
            output.status = "error: prompt must be max 5000 characters"
            return output

        # Handle and validate input_image_paths
        image_paths = inputs.input_image_paths or []
        if not isinstance(image_paths, list) or len(image_paths) > 8:
            output.status = "error: input_image_paths must be a list with 0 to 8 paths"
            return output

        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
        MAX_FILE_SIZE = 30 * 1024 * 1024  # 30 MB
        upload_urls = []
        upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
        upload_path = "images/user-uploads"
        auth_header = {"Authorization": f"Bearer {config.api_key}"}

        for path in image_paths:
            if not os.path.exists(path) or not os.path.isfile(path):
                output.status = f"error: Invalid path or not a file: {path}"
                return output

            file_size = os.path.getsize(path)
            if file_size > MAX_FILE_SIZE:
                output.status = f"error: File too large {path}: {file_size / (1024*1024):.1f}MB > 30MB"
                return output

            _, ext = os.path.splitext(path.lower())
            if ext not in allowed_extensions:
                output.status = f"error: Unsupported file extension for {path}; must be .jpg, .jpeg, .png, or .webp"
                return output

            # Upload file to get URL
            # 1. Get the real filename
            original_basename = os.path.basename(path)
            name_part, ext_part = os.path.splitext(original_basename)
            
            # 2. Generate a unique name using a timestamp (milliseconds)
            # This ensures even if the local file is 'image.png', the server gets 'image_1710000000.png'
            timestamp_str = str(int(time.time() * 1000))
            unique_filename = f"{name_part}_{timestamp_str}{ext_part}"
            
            mime_type, _ = mimetypes.guess_type(path)
            if mime_type is None:
                mime_type = "application/octet-stream"
            
            try:
                with open(path, 'rb') as f:
                    # 3. Pass 'unique_filename' in the files tuple and the data dict
                    # The tuple format is (filename_sent_to_server, file_object, mime_type)
                    files = {'file': (unique_filename, f, mime_type)}
                    data = {
                        'uploadPath': upload_path,
                        'fileName': unique_filename 
                    }
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

        # Validate aspect_ratio
        allowed_aspects = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
        aspect_to_use = None
        if inputs.aspect_ratio is not None:
            ar = str(inputs.aspect_ratio).strip()
            if ar in ["", "auto"]:
                aspect_to_use = None
            elif ar in allowed_aspects:
                aspect_to_use = ar
            else:
                output.status = f"error: aspect_ratio must be 'auto'/empty/None (omit), or one of {allowed_aspects}"
                return output

        # Validate resolution
        allowed_resolutions = ["1K", "2K", "4K"]
        res_to_use = inputs.resolution or "2K"
        if res_to_use not in allowed_resolutions:
            output.status = f"error: resolution must be one of {allowed_resolutions} (default '2K')"
            return output

        # Validate output_format
        fmt_to_use = inputs.output_format or "png"
        if fmt_to_use not in ["png", "jpg"]:
            output.status = "error: output_format must be 'png' or 'jpg' (default 'png')"
            return output

        model = "nano-banana-pro"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create input payload
        input_payload = {
            "prompt": inputs.prompt,
            "resolution": res_to_use,
            "output_format": fmt_to_use
        }
        if upload_urls:
            input_payload["image_input"] = upload_urls
        if aspect_to_use:
            input_payload["aspect_ratio"] = aspect_to_use

        # Create task
        create_url = f"{base_url}/createTask"
        payload = {
            "model": model,
            "input": input_payload
        }
        response = requests.post(create_url, headers=headers, json=payload)
        result = response.json()
        if result.get("code") != 200:
            output.status = f"error: Failed to create task - {result.get('message', result.get('msg', 'Unknown error'))}"
            return output

        task_id = result["data"]["taskId"]
        output.task_id = task_id

        # Poll for completion
        query_url = "https://api.kie.ai/api/v1/jobs/recordInfo"
        start_time = time.time()
        poll_success = False
        polling_interval = config.polling_interval or 5
        max_duration = config.max_duration or 300

        while time.time() - start_time < max_duration:
            qresponse = requests.get(query_url, headers={"Authorization": f"Bearer {config.api_key}"}, params={"taskId": task_id})
            qresult = qresponse.json()
            if qresult.get("code") != 200:
                output.status = f"error: Failed to query task - {qresult.get('message', qresult.get('msg', 'Unknown error'))}"
                return output

            data = qresult["data"]
            state = data.get("state")
            if state == "success":
                result_json_str = data.get("resultJson", "{}")
                result_json = json.loads(result_json_str)
                image_urls = result_json.get("resultUrls", [])
                output.temporary_image_url = image_urls[0] if image_urls else ""

                # Download and save the first image if available
                if image_urls:
                    home_path = await get_home_path()
                    ext = fmt_to_use
                    base_name = inputs.filename if inputs.filename is not None else task_id
                    base_name = os.path.splitext(base_name)[0]  # Sanitize: remove extension if present
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
                        output.status = f"partial_success: Failed to download the image - {str(dl_e)}"
                        output.saved_image_path = ""
                else:
                    output.status = "success: No images generated"
                    output.saved_image_path = ""

                poll_success = True
                break
            elif state == "fail":
                fail_msg = data.get("failMsg", data.get("message", "Unknown failure"))
                output.status = f"error: Task failed - {fail_msg}"
                return output
            elif state not in ["waiting", "queuing", "generating"]:
                output.status = f"error: Unexpected task state - {state}"
                return output

            time.sleep(polling_interval)

        if not poll_success:
            output.status = f"error: Task timed out after {max_duration} seconds"
            return output

    except Exception as e:
        output.status = f"error: {str(e)}"
        return output

    return output