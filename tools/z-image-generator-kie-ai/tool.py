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
    # prompt: Required string, max 1000 characters
    prompt: str
    # aspect_ratio: Optional string, must be one of '1:1', '4:3', '3:4', '16:9', '9:16'. Defaults to '4:3'
    aspect_ratio: Optional[str] = "4:3"
    # filename: Optional string for base filename (without extension), defaults to None (uses task_id)
    filename: Optional[str] = None

class OUTPUT:
    temporary_image_url: str
    task_id: str
    saved_local_image_path: str
    status: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.temporary_image_url = ""
    output.task_id = ""
    output.saved_local_image_path = ""
    output.status = "error: unknown"

    try:
        # Validate prompt length
        if len(inputs.prompt) > 1000:
            output.status = "error: prompt must be max 1000 characters"
            return output

        # Resolve aspect_ratio (handle None if passed explicitly, though default is set)
        aspect_ratio_val = inputs.aspect_ratio if inputs.aspect_ratio else "4:3"

        # Validate aspect_ratio
        allowed_ratios = ["1:1", "4:3", "3:4", "16:9", "9:16"]
        if aspect_ratio_val not in allowed_ratios:
            output.status = f"error: aspect_ratio must be one of {allowed_ratios}"
            return output

        model = "z-image"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task payload
        input_payload = {
            "prompt": inputs.prompt,
            "aspect_ratio": aspect_ratio_val
        }
        payload = {
            "model": model,
            "input": input_payload
        }

        response = requests.post(f"{base_url}/createTask", headers=headers, json=payload)
        if response.status_code != 200:
            output.status = f"error: HTTP {response.status_code} creating task - {response.text[:200]}"
            return output
        try:
            result = response.json()
        except json.JSONDecodeError:
            output.status = f"error: Invalid JSON response creating task - {response.text[:200]}"
            return output
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
                output.status = f"error: HTTP {qresponse.status_code} querying task - {qresponse.text[:200]}"
                return output
            try:
                qresult = qresponse.json()
            except json.JSONDecodeError:
                output.status = f"error: Invalid JSON response querying task - {qresponse.text[:200]}"
                return output
            if qresult.get("code") != 200:
                output.status = f"error: Failed to query task - {qresult.get('message', 'Unknown error')}"
                return output

            data = qresult["data"]
            state = data.get("state")
            if state == "success":
                result_json_str = data.get("resultJson", "{}")
                try:
                    result_json = json.loads(result_json_str)
                except json.JSONDecodeError:
                    output.status = f"error: Invalid resultJson - {result_json_str[:200]}"
                    return output
                image_urls = result_json.get("resultUrls", [])
                output.temporary_image_url = image_urls[0] if image_urls else ""

                # Download and save image if available
                if output.temporary_image_url:
                    home_path = await get_home_path()
                    ext = "png"
                    base_name = inputs.filename if inputs.filename is not None else task_id
                    base_name = os.path.splitext(base_name)[0]  # Sanitize: remove extension if present
                    filename = f"{base_name}.{ext}"
                    local_path = os.path.join(home_path, filename)
                    try:
                        dl_response = requests.get(output.temporary_image_url, stream=True)
                        dl_response.raise_for_status()
                        with open(local_path, 'wb') as f:
                            for chunk in dl_response.iter_content(chunk_size=8192):
                                f.write(chunk)
                        output.saved_local_image_path = local_path
                        output.status = "success"
                    except Exception as dl_e:
                        output.status = f"error: Download failed - {str(dl_e)}"
                        output.saved_local_image_path = ""
                else:
                    output.status = "success: No image generated"
                    output.saved_local_image_path = ""

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