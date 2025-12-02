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
    # task_id: Required string, task ID from original Veo video generation task
    task_id: str
    # prompt: Required string describing the desired video extension content, max 5000 characters
    prompt: str
    # seed: Optional[int] between 10000-99999 for reproducible generations
    seed: Optional[int] = None
    # watermark: Optional[str] text to overlay as watermark on video
    watermark: Optional[str] = None
    # filename: Optional[str] base filename (without extension) for downloaded video; defaults to task_id
    filename: Optional[str] = None

class OUTPUT:
    # video_urls: List of URLs to the generated extended videos
    video_urls: List[str]
    # task_id: ID of the extension task
    task_id: str
    # local_path: Path to the downloaded video file in home directory
    local_path: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.video_urls = []
    output.task_id = ""
    output.local_path = ""

    # Input validation
    if not inputs.prompt or not inputs.prompt.strip():
        raise ValueError("prompt must not be empty")
    if len(inputs.prompt) > 5000:
        raise ValueError("prompt must be max 5000 characters")
    if not inputs.task_id or not inputs.task_id.strip():
        raise ValueError("task_id must not be empty")

    # Validate seed
    if inputs.seed is not None and not (10000 <= inputs.seed <= 99999):
        raise ValueError("seed must be an integer between 10000 and 99999 if provided")

    # Create task
    base_url = "https://api.kie.ai/api/v1/veo"
    create_url = f"{base_url}/extend"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.api_key}"
    }
    payload = {
        "taskId": inputs.task_id.strip(),
        "prompt": inputs.prompt
    }
    if inputs.seed is not None:
        payload["seeds"] = inputs.seed
    if inputs.watermark:
        payload["watermark"] = inputs.watermark

    response = requests.post(create_url, headers=headers, json=payload)
    if response.status_code != 200:
        try:
            result = response.json()
        except json.JSONDecodeError:
            result = {"msg": response.text[:200]}
        raise ValueError(f"Failed to create extend task HTTP {response.status_code}: {result.get('msg', 'Unknown error')}")
    try:
        result = response.json()
    except json.JSONDecodeError:
        raise ValueError(f"Invalid JSON create response: {response.text[:200]}")
    if result.get("code") != 200:
        raise ValueError(f"Failed to create extend task: code {result.get('code')}, {result.get('msg', 'Unknown error')}")

    new_task_id = result["data"]["taskId"]
    output.task_id = new_task_id

    # Poll for completion
    query_url = f"{base_url}/record-info"
    start_time = time.time()
    poll_interval = config.polling_interval or 5
    max_duration = config.max_duration or 300

    while time.time() - start_time < max_duration:
        qresponse = requests.get(
            query_url,
            headers={"Authorization": f"Bearer {config.api_key}"},
            params={"taskId": new_task_id}
        )
        if qresponse.status_code != 200:
            try:
                qresult = qresponse.json()
                raise ValueError(f"Query failed HTTP {qresponse.status_code}: code {qresult.get('code')}, msg {qresult.get('msg', qresponse.text[:200])}")
            except json.JSONDecodeError:
                raise ValueError(f"Query HTTP {qresponse.status_code}: {qresponse.text[:200]}")
        try:
            qresult = qresponse.json()
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON query response: {qresponse.text[:200]}")
        if qresult.get("code") != 200:
            raise ValueError(f"Query code {qresult.get('code')}: {qresult.get('msg', 'Unknown error')}")

        data = qresult.get("data")
        if not data:
            time.sleep(poll_interval)
            continue

        success_flag = int(data.get("successFlag", 0))
        if success_flag == 1:
            response_data = data.get("response", {})
            video_urls = response_data.get("resultUrls", [])
            output.video_urls = video_urls

            # Download first video if available
            if video_urls:
                home_path = await get_home_path()
                if inputs.filename and inputs.filename.strip():
                    base_name = inputs.filename.strip()
                    filename = f"{base_name}.mp4"
                else:
                    filename = f"{new_task_id}.mp4"
                local_path = os.path.join(home_path, filename)
                download_url = video_urls[0]
                try:
                    dl_response = requests.get(download_url, stream=True)
                    dl_response.raise_for_status()
                    with open(local_path, 'wb') as f:
                        for chunk in dl_response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    output.local_path = local_path
                except Exception as dl_e:
                    raise ValueError(f"Failed to download and save video: {str(dl_e)}")
            return output
        elif success_flag in (2, 3):
            error_msg = data.get("errorMessage", "")
            error_code = data.get("errorCode")
            msg = f"Extend task failed (successFlag={success_flag})"
            if error_msg:
                msg += f": {error_msg}"
            if error_code:
                msg += f" (errorCode={error_code})"
            raise ValueError(msg)

        time.sleep(poll_interval)

    raise TimeoutError(f"Extend task {new_task_id} timed out after {max_duration} seconds")