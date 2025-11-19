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
    polling_interval: Optional[int] = 5
    max_duration: Optional[int] = 300

class INPUTS:
    # prompt: max 5000 characters
    prompt: str
    # aspect_ratio: One of '3:2', '2:3', '1:1'. Default: '3:2'
    aspect_ratio: Optional[str] = "3:2"
    # mode: One of 'normal', 'fun', 'spicy'. Default: 'normal'
    mode: Optional[str] = "normal"
    filename: Optional[str] = None

class OUTPUT:
    video_urls: List[str]
    task_id: str
    local_path: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    base_url = "https://api.kie.ai/api/v1/jobs"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.api_key}"
    }

    # Create task
    create_url = f"{base_url}/createTask"
    effective_aspect = inputs.aspect_ratio or "3:2"
    effective_mode = inputs.mode or "normal"
    payload = {
        "model": "grok-imagine/text-to-video",
        "input": {
            "prompt": inputs.prompt,
            "aspect_ratio": effective_aspect,
            "mode": effective_mode
        }
    }

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

        time.sleep(config.polling_interval)

    raise TimeoutError(f"Task timed out after {config.max_duration} seconds")