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
    # default_model: String specifying the default model, defaults to "google/imagen4"
    default_model: str = "google/imagen4"
    # polling_interval: Optional integer for seconds between status polls, defaults to 5
    polling_interval: Optional[int] = 5
    # max_duration: Optional integer for maximum wait time in seconds, defaults to 300
    max_duration: Optional[int] = 300

class INPUTS:
    # prompt: Required string, max 5000 characters
    prompt: str
    # negative_prompt: Optional string, max 5000 characters; empty string or whitespace treated as not provided
    negative_prompt: Optional[str] = None
    # aspect_ratio: Optional string, must be one of '1:1', '16:9', '9:16', '3:4', '4:3'; empty string or whitespace treated as not provided (API default)
    aspect_ratio: Optional[str] = None
    # num_images: Optional string, must be one of '1', '2', '3', '4'; for 'google/imagen4-ultra', limited to '1'; defaults to '1' if empty
    num_images: Optional[str] = "1"
    # seed: Optional string, max 500 characters; empty string or whitespace treated as not provided
    seed: Optional[str] = None
    # model_override: Optional string to override the default_model, must be one of 'google/imagen4-ultra', 'google/imagen4-fast', 'google/imagen4', empty string or None (treated as no override)
    model_override: Optional[str] = None
    # filename: Optional string for base filename of saved images (without extension); empty or None uses task_id
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
        # Validate default_model in config
        allowed_models = ["google/imagen4-ultra", "google/imagen4-fast", "google/imagen4"]
        if config.default_model not in allowed_models:
            output.status = f"error: default_model must be one of {allowed_models}"
            return output

        # Select effective model, treating empty string as no override
        override = inputs.model_override.strip() if inputs.model_override else ""
        model = override if override else config.default_model

        # Validate model_override if provided and non-empty
        if override and model not in allowed_models:
            output.status = f"error: model_override must be one of {allowed_models} or empty string/None (default '{config.default_model}')"
            return output

        # Prepare effective values for optional fields, treating empty/whitespace as not provided
        neg_prompt = inputs.negative_prompt.strip() if inputs.negative_prompt else ""
        aspect = inputs.aspect_ratio.strip() if inputs.aspect_ratio else ""
        seed_val = inputs.seed.strip() if inputs.seed else ""
        effective_num = inputs.num_images or "1"

        # Validate prompt
        if not inputs.prompt or len(inputs.prompt) > 5000:
            output.status = "error: prompt is required and must be max 5000 characters"
            return output

        # Validate negative_prompt if non-empty
        if neg_prompt and len(neg_prompt) > 5000:
            output.status = "error: negative_prompt must be max 5000 characters"
            return output

        # Validate aspect_ratio if non-empty
        allowed_ratios = ["1:1", "16:9", "9:16", "3:4", "4:3"]
        if aspect and aspect not in allowed_ratios:
            output.status = f"error: aspect_ratio must be one of {allowed_ratios} or empty"
            return output

        # Validate num_images (general)
        allowed_num = ["1", "2", "3", "4"]
        if effective_num not in allowed_num:
            output.status = f"error: num_images must be one of {allowed_num} or empty (default '1')"
            return output

        # Validate num_images based on model limits
        if model == "google/imagen4-ultra" and effective_num != "1":
            output.status = f"error: For model '{model}', num_images is limited to 1. Requested: {effective_num}"
            return output

        # Validate seed if non-empty
        if seed_val and len(seed_val) > 500:
            output.status = "error: seed must be max 500 characters"
            return output

        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task
        create_url = f"{base_url}/createTask"
        payload = {
            "model": model,
            "input": {
                "prompt": inputs.prompt,
                "num_images": effective_num
            }
        }
        if neg_prompt:
            payload["input"]["negative_prompt"] = neg_prompt
        if aspect:
            payload["input"]["aspect_ratio"] = aspect
        if seed_val:
            payload["input"]["seed"] = seed_val

        response = requests.post(create_url, headers=headers, json=payload)
        result = response.json()
        if result.get("code") != 200:
            error_msg = result.get('message', 'Unknown error')
            # Catch and inform about num_images limit for ultra model
            if model == "google/imagen4-ultra" and ("num_images" in error_msg or "1" in error_msg or "limit" in error_msg.lower()):
                error_msg = f"{error_msg}. Note: For '{model}', num_images is limited to 1."
            output.status = f"error: Failed to create task - {error_msg}"
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
                download_success = True
                if image_urls:
                    home_path = await get_home_path()
                    local_paths = []
                    ext = "jpg"

                    # Prepare base name for filenames
                    filename_input = inputs.filename.strip() if inputs.filename else ""
                    if filename_input:
                        base_name = os.path.splitext(filename_input)[0]  # Remove extension if present
                    else:
                        base_name = task_id

                    for i, download_url in enumerate(image_urls, start=1):
                        filename = f"{base_name}_{i}.{ext}"
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
            output.status = f"error: Task timed out after {config.max_duration} seconds"
            return output

    except Exception as e:
        output.status = f"error: {str(e)}"
        return output

    return output