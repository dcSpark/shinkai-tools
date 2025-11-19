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
    # prompt: Required string, max 5000 characters
    prompt: str
    # input_image_paths: Required list of strings, local paths to input images for editing, up to 10; accepted types: image/jpeg, image/png, image/webp
    input_image_paths: List[str]
    # image_size: Optional string, must be one of 'square', 'square_hd', 'portrait_4_3', 'portrait_3_2', 'portrait_16_9', 'landscape_4_3', 'landscape_3_2', 'landscape_16_9', 'landscape_21_9'; defaults to None (omitted from API)
    image_size: Optional[str] = None
    # image_resolution: Optional string, must be one of '1K', '2K', '4K'; defaults to '2K'
    image_resolution: Optional[str] = "2K"
    # max_images: Optional integer, 1-6; defaults to 1
    max_images: Optional[int] = 1
    # seed: Optional integer for random seed; defaults to None (omitted from API)
    seed: Optional[int] = None
    # output_format: Optional string, must be 'png' or 'jpeg'; defaults to 'png' (used for local save extension only)
    output_format: Optional[str] = "png"
    # filename: Optional string for base filename (without extension), defaults to None (uses task_id)
    filename: Optional[str] = None

class OUTPUT:
    temporary_image_urls: List[str]
    task_id: str
    saved_images_paths: List[str]
    status: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.temporary_image_urls = []
    output.task_id = ""
    output.saved_images_paths = []
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
        allowed_sizes = ["square", "square_hd", "portrait_4_3", "portrait_3_2", "portrait_16_9", "landscape_4_3", "landscape_3_2", "landscape_16_9", "landscape_21_9"]
        if inputs.image_size is not None and inputs.image_size not in allowed_sizes:
            output.status = f"error: image_size must be one of {allowed_sizes} or None (omitted, default API behavior)"
            return output

        # Validate image_resolution
        allowed_resolutions = ["1K", "2K", "4K"]
        effective_resolution = inputs.image_resolution or "2K"
        if effective_resolution not in allowed_resolutions:
            output.status = f"error: image_resolution must be one of {allowed_resolutions} (default '2K')"
            return output

        # Validate max_images
        effective_max_images = inputs.max_images or 1
        if not isinstance(effective_max_images, int) or effective_max_images < 1 or effective_max_images > 6:
            output.status = "error: max_images must be an integer between 1 and 6 (default 1)"
            return output

        # Validate seed (basic type check)
        if inputs.seed is not None and not isinstance(inputs.seed, int):
            output.status = "error: seed must be an integer or None"
            return output

        # Validate output_format
        effective_format = inputs.output_format or "png"
        if effective_format not in ["png", "jpeg"]:
            output.status = "error: output_format must be 'png' or 'jpeg' or None (default 'png')"
            return output

        model = "bytedance/seedream-v4-edit"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task payload
        input_payload = {
            "prompt": inputs.prompt,
            "image_urls": upload_urls,
            "image_resolution": effective_resolution,
            "max_images": effective_max_images
        }
        if inputs.image_size is not None:
            input_payload["image_size"] = inputs.image_size
        if inputs.seed is not None:
            input_payload["seed"] = inputs.seed

        payload = {
            "model": model,
            "input": input_payload
        }

        response = requests.post(f"{base_url}/createTask", headers=headers, json=payload)
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
                output.temporary_image_urls = image_urls

                # Download and save all images if available
                if image_urls:
                    home_path = await get_home_path()
                    ext = effective_format
                    base_name = inputs.filename if inputs.filename is not None else task_id
                    base_name = os.path.splitext(base_name)[0]  # Sanitize: remove extension if present
                    saved_paths = []
                    all_success = True
                    for i, download_url in enumerate(image_urls, 1):
                        filename = f"{base_name}_{i}.{ext}"
                        local_path = os.path.join(home_path, filename)
                        try:
                            dl_response = requests.get(download_url, stream=True)
                            dl_response.raise_for_status()
                            with open(local_path, 'wb') as f:
                                for chunk in dl_response.iter_content(chunk_size=8192):
                                    f.write(chunk)
                            saved_paths.append(local_path)
                        except Exception as dl_e:
                            all_success = False
                    output.saved_images_paths = saved_paths
                    if all_success:
                        output.status = "success"
                    else:
                        failed_count = len(image_urls) - len(saved_paths)
                        output.status = f"partial_success: {failed_count} downloads failed"
                else:
                    output.status = "success: No images generated"
                    output.saved_images_paths = []

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