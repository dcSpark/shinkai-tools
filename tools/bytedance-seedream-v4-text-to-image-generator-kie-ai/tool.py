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
    # image_size: Optional string, must be one of 'square', 'square_hd', 'portrait_4_3', 'portrait_3_2', 'portrait_16_9', 'landscape_4_3', 'landscape_3_2', 'landscape_16_9', 'landscape_21_9'; defaults to None (omit for API default)
    image_size: Optional[str] = None
    # image_resolution: Optional string, must be one of '1K', '2K', '4K'; defaults to None (omit for API default)
    image_resolution: Optional[str] = None
    # max_images: Optional integer, must be 1-6; defaults to 1 (always included in payload)
    max_images: Optional[int] = 1
    # seed: Optional integer for random seed to control generation; defaults to None (omit if not provided)
    seed: Optional[int] = None
    # filename: Optional string for base filename (without extension); defaults to None (uses task_id)
    filename: Optional[str] = None

class OUTPUT:
    temporary_image_urls: List[str]
    task_id: str
    saved_images_paths: List[str]
    status: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    # Normalize empty strings to None for optional fields to handle blank inputs
    if inputs.image_size == "":
        inputs.image_size = None
    if inputs.image_resolution == "":
        inputs.image_resolution = None
    if inputs.filename == "":
        inputs.filename = None

    output = OUTPUT()
    output.temporary_image_urls = []
    output.task_id = ""
    output.saved_images_paths = []
    output.status = "error: unknown"

    try:
        # Validate prompt length
        if len(inputs.prompt) > 5000:
            output.status = "error: prompt must be max 5000 characters"
            return output

        # Validate image_size
        allowed_sizes = ["square", "square_hd", "portrait_4_3", "portrait_3_2", "portrait_16_9", "landscape_4_3", "landscape_3_2", "landscape_16_9", "landscape_21_9"]
        if inputs.image_size is not None and inputs.image_size not in allowed_sizes:
            output.status = f"error: image_size must be one of {allowed_sizes} or None"
            return output

        # Validate image_resolution
        allowed_resolutions = ["1K", "2K", "4K"]
        if inputs.image_resolution is not None and inputs.image_resolution not in allowed_resolutions:
            output.status = f"error: image_resolution must be one of {allowed_resolutions} or None"
            return output

        # Validate max_images
        effective_max_images = inputs.max_images if inputs.max_images is not None else 1
        if not (1 <= effective_max_images <= 6):
            output.status = "error: max_images must be integer 1-6 (default 1)"
            return output

        model = "bytedance/seedream-v4-text-to-image"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task
        create_url = f"{base_url}/createTask"
        input_dict = {
            "prompt": inputs.prompt,
            "max_images": effective_max_images
        }
        if inputs.image_size is not None:
            input_dict["image_size"] = inputs.image_size
        if inputs.image_resolution is not None:
            input_dict["image_resolution"] = inputs.image_resolution
        if inputs.seed is not None:
            input_dict["seed"] = inputs.seed

        payload = {
            "model": model,
            "input": input_dict
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

        while time.time() - start_time < (config.max_duration or 300):
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