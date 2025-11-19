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
from urllib.parse import urlparse, urlunparse, quote
from shinkai_local_support import get_home_path

class CONFIG:
    # api_key: Required string for kie.ai API authentication
    api_key: str
    # polling_interval: Optional integer for seconds between status polls, defaults to 5
    polling_interval: Optional[int] = 5
    # max_duration: Optional integer for maximum wait time in seconds, defaults to 300
    max_duration: Optional[int] = 300

class INPUTS:
    # prompt: Required string, max 2000 characters
    prompt: str
    # input_image_path: Required string, local path to input image; accepted types: image/jpeg, image/png, image/webp; max size: 10.0MB
    input_image_path: str
    # acceleration: Optional string, must be one of 'none', 'regular', 'high'; defaults to 'none'
    acceleration: Optional[str] = None
    # image_size: Optional string, must be one of 'square', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'; defaults to 'landscape_4_3'
    image_size: Optional[str] = None
    # num_inference_steps: Optional integer, min 2 max 49 step 1; defaults to 30
    num_inference_steps: Optional[int] = None
    # seed: Optional integer for random seed to control generation; defaults to None (omit if not provided)
    seed: Optional[int] = None
    # guidance_scale: Optional float, min 0 max 20 step 0.1; defaults to 4
    guidance_scale: Optional[float] = None
    # num_images: Optional integer, must be 1-4; defaults to 1 (always included in payload)
    num_images: Optional[int] = None
    # enable_safety_checker: Optional boolean, defaults to False (always included in payload)
    enable_safety_checker: Optional[bool] = None
    # output_format: Optional string, must be one of 'jpeg', 'png'; defaults to 'png'
    output_format: Optional[str] = None
    # negative_prompt: Optional string, max 500 characters; defaults to None (omit if not provided)
    negative_prompt: Optional[str] = None
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
    if inputs.acceleration == "":
        inputs.acceleration = None
    if inputs.image_size == "":
        inputs.image_size = None
    if inputs.negative_prompt == "":
        inputs.negative_prompt = None
    if inputs.filename == "":
        inputs.filename = None
    if inputs.input_image_path == "":
        inputs.input_image_path = None
    if inputs.output_format == "":
        inputs.output_format = None

    output = OUTPUT()
    output.temporary_image_urls = []
    output.task_id = ""
    output.saved_images_paths = []
    output.status = "error: unknown"

    try:
        # Validate input_image_path
        if inputs.input_image_path is None:
            output.status = "error: input_image_path is required"
            return output
        path = inputs.input_image_path.strip()
        if not path:
            output.status = "error: input_image_path cannot be empty"
            return output
        if not os.path.exists(path) or not os.path.isfile(path):
            output.status = f"error: Invalid path or not a file: {path}"
            return output
        file_size = os.path.getsize(path)
        if file_size > 10 * 1024 * 1024:
            output.status = f"error: Image file too large: {file_size} bytes, max 10MB"
            return output
        ext = os.path.splitext(path.lower())[1]
        allowed_exts = ['.jpg', '.jpeg', '.png', '.webp']
        if ext not in allowed_exts:
            output.status = f"error: Unsupported file extension {ext}; must be one of {allowed_exts}"
            return output

        # Validate prompt
        if inputs.prompt is None or len(inputs.prompt.strip()) == 0 or len(inputs.prompt) > 2000:
            output.status = "error: prompt must be non-empty and max 2000 characters"
            return output

        # Set and validate defaults for optional fields
        effective_acceleration = inputs.acceleration or "none"
        allowed_accelerations = ["none", "regular", "high"]
        if effective_acceleration not in allowed_accelerations:
            output.status = f"error: acceleration must be one of {allowed_accelerations}"
            return output

        effective_image_size = inputs.image_size or "landscape_4_3"
        allowed_sizes = ["square", "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"]
        if effective_image_size not in allowed_sizes:
            output.status = f"error: image_size must be one of {allowed_sizes}"
            return output

        effective_num_inference_steps = inputs.num_inference_steps or 30
        if not (2 <= effective_num_inference_steps <= 49) or not isinstance(effective_num_inference_steps, int):
            output.status = "error: num_inference_steps must be integer 2-49 (default 30)"
            return output

        effective_guidance_scale = inputs.guidance_scale or 4.0
        if not (0 <= effective_guidance_scale <= 20):
            output.status = "error: guidance_scale must be between 0 and 20"
            return output

        effective_num_images = inputs.num_images or 1
        if not (1 <= effective_num_images <= 4):
            output.status = "error: num_images must be integer 1-4 (default 1)"
            return output

        effective_enable_safety_checker = inputs.enable_safety_checker if inputs.enable_safety_checker is not None else False

        effective_output_format = inputs.output_format or "png"
        allowed_formats = ["jpeg", "png"]
        if effective_output_format not in allowed_formats:
            output.status = f"error: output_format must be one of {allowed_formats}"
            return output

        # Validate negative_prompt length
        if inputs.negative_prompt is not None and len(inputs.negative_prompt) > 500:
            output.status = "error: negative_prompt must be max 500 characters"
            return output

        # Upload input image to get URL
        upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
        upload_path = "images/user-uploads"
        auth_header = {"Authorization": f"Bearer {config.api_key}"}
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
            image_url = upload_result.get("data", {}).get("downloadUrl")
            if not image_url:
                output.status = f"error: No download URL returned for {path}"
                return output
            # Encode the URL path to handle spaces and special characters in filenames
            parsed = urlparse(image_url)
            encoded_path = quote(parsed.path, safe='/')
            image_url = urlunparse((parsed.scheme, parsed.netloc, encoded_path, parsed.params, parsed.query, parsed.fragment))
        except Exception as upload_e:
            output.status = f"error: Exception uploading {path} - {str(upload_e)}"
            return output

        model = "qwen/image-edit"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task
        create_url = f"{base_url}/createTask"
        input_dict = {
            "prompt": inputs.prompt.strip(),
            "image_url": image_url,
            "acceleration": effective_acceleration,
            "image_size": effective_image_size,
            "num_inference_steps": effective_num_inference_steps,
            "guidance_scale": effective_guidance_scale,
            "sync_mode": False,
            "num_images": str(effective_num_images),
            "enable_safety_checker": effective_enable_safety_checker,
            "output_format": effective_output_format
        }
        if inputs.seed is not None:
            input_dict["seed"] = inputs.seed
        if inputs.negative_prompt is not None:
            input_dict["negative_prompt"] = inputs.negative_prompt.strip()

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
                    ext = "jpg" if effective_output_format == "jpeg" else "png"
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