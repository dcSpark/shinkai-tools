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
    api_key: str
    polling_interval: Optional[int] = 10
    max_duration: Optional[int] = 420

class INPUTS:
    prompt: str
    duration: Optional[str] = "5"
    aspect_ratio: Optional[str] = "16:9"
    resolution: Optional[str] = "720p"
    negative_prompt: Optional[str] = None
    enable_prompt_expansion: Optional[bool] = False
    seed: Optional[int] = None
    filename: Optional[str] = None

class OUTPUT:
    video_urls: List[str]
    task_id: str
    local_path: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    # Input validations
    if len(inputs.prompt) > 800:
        raise ValueError("Prompt exceeds maximum length of 800 characters.")

    if inputs.negative_prompt:
        neg = inputs.negative_prompt.strip()
        if neg and len(neg) > 500:
            raise ValueError("Negative prompt exceeds maximum length of 500 characters.")

    effective_duration = inputs.duration or "5"
    if effective_duration not in ["5", "10"]:
        raise ValueError(f"Invalid duration '{effective_duration}'. Must be one of '5', '10', or None (defaults to '5').")

    effective_aspect = inputs.aspect_ratio or "16:9"
    if effective_aspect not in ["16:9", "9:16", "1:1"]:
        raise ValueError(f"Invalid aspect ratio '{effective_aspect}'. Must be one of '16:9', '9:16', '1:1', or None (defaults to '16:9').")

    effective_resolution = inputs.resolution or "720p"
    if effective_resolution not in ["720p", "1080p"]:
        raise ValueError(f"Invalid resolution '{effective_resolution}'. Must be one of '720p', '1080p', or None (defaults to '720p').")

    model = "wan/2-5-text-to-video"
    base_url = "https://api.kie.ai/api/v1/jobs"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.api_key}"
    }

    # Create task payload
    input_payload = {
        "prompt": inputs.prompt,
        "duration": effective_duration,
        "aspect_ratio": effective_aspect,
        "resolution": effective_resolution,
        "enable_prompt_expansion": inputs.enable_prompt_expansion or False
    }

    if inputs.negative_prompt:
        neg = inputs.negative_prompt.strip()
        if neg:
            input_payload["negative_prompt"] = inputs.negative_prompt

    if inputs.seed is not None:
        input_payload["seed"] = inputs.seed

    payload = {
        "model": model,
        "input": input_payload
    }

    create_url = f"{base_url}/createTask"
    response = requests.post(create_url, headers=headers, json=payload)
    result = response.json()
    if result.get("code") != 200:
        raise ValueError(f"Failed to create task: {result.get('message', 'Unknown error')}")

    task_id = result["data"]["taskId"]
    output = OUTPUT()
    output.task_id = task_id
    output.video_urls = []
    output.local_path = ""

    # Poll for completion
    query_url = "https://api.kie.ai/api/v1/jobs/recordInfo"
    start_time = time.time()

    while time.time() - start_time < config.max_duration:
        qresponse = requests.get(query_url, headers={"Authorization": f"Bearer {config.api_key}"}, params={"taskId": task_id})
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
                if inputs.filename:
                    base_name = os.path.splitext(os.path.basename(inputs.filename))[0]
                    if not base_name.strip():
                        filename = f"{task_id}.mp4"
                    else:
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

        time.sleep(config.polling_interval)

    raise TimeoutError(f"Task timed out after {config.max_duration} seconds")