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
    # input_image_paths: Required list of strings, local paths to input images for editing, up to 10; accepted types: image/jpeg, image/png, image/webp
    input_image_paths: List[str]
    # image_size: Optional string, must be one of '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9', 'auto'; defaults to 'auto'
    image_size: Optional[str] = "auto"
    # output_format: Optional string, must be 'png' or 'jpeg'; defaults to 'png'
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
        # Validate input_image_paths
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
        if not inputs.input_image_paths or len(inputs.input_image_paths) > 10:
            output.status = "error: input_image_paths must be a non-empty list with up to 10 paths"
            return output
        upload_urls = []
        upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
        upload_path = "images/user-uploads"
        auth_header = {"Authorization": f"Bearer {config.api_key}"}
        for path in inputs.input_image_paths:
            if not os.path.exists(path) or not os.path.isfile(path):
                output.status = f"error: Invalid path or not a file: {path}"
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
                    data = {
                        'uploadPath': upload_path,
                        'fileName': basename
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

        # Validate prompt length
        if len(inputs.prompt) > 5000:
            output.status = "error: prompt must be max 5000 characters"
            return output

        # Validate image_size
        allowed_sizes = ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9", "auto"]
        if inputs.image_size is not None and inputs.image_size not in allowed_sizes:
            output.status = f"error: image_size must be one of {allowed_sizes} or empty (default 'auto')"
            return output

        # Validate output_format
        if inputs.output_format is not None and inputs.output_format not in ["png", "jpeg"]:
            output.status = "error: output_format must be 'png' or 'jpeg' or empty (default 'png')"
            return output

        model = "google/nano-banana-edit"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task
        create_url = f"{base_url}/createTask"
        effective_size = inputs.image_size or "auto"
        effective_format = inputs.output_format or "png"
        payload = {
            "model": model,
            "input": {
                "prompt": inputs.prompt,
                "image_urls": upload_urls,
                "image_size": effective_size,
                "output_format": effective_format
            }
        }

        response = requests.post(create_url, headers=headers, json=payload)
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

        while time.time() - start_time < config.max_duration:
            qresponse = requests.get(query_url, headers={"Authorization": f"Bearer {config.api_key}"}, params={"taskId": task_id})
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
                if image_urls:
                    output.temporary_image_url = image_urls[0]
                else:
                    output.temporary_image_url = ""

                # Download and save the single image if available
                if image_urls:
                    home_path = await get_home_path()
                    ext = effective_format
                    base_name = inputs.filename if inputs.filename is not None else task_id
                    base_name = os.path.splitext(base_name)[0]  # Sanitize: remove extension if present
                    # Assume only one image; take the first URL
                    download_url = image_urls[0]
                    filename = f"{base_name}.{ext}"
                    local_path = os.path.join(home_path, filename)
                    try:
                        dl_response = requests.get(download_url, stream=True)
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
                fail_msg = data.get("failMsg", "Unknown failure")
                output.status = f"error: Task failed - {fail_msg}"
                return output
            elif state not in ["waiting", "queuing", "generating"]:
                output.status = f"error: Unexpected task state - {state}"
                return output

            time.sleep(config.polling_interval)

        if not poll_success:
            output.status = f"error: Task timed out after {config.max_duration} seconds"
            return output

    except Exception as e:
        output.status = f"error: {str(e)}"
        return output

    return output