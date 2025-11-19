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
    # aspect_ratio: Optional string, must be one of '2:3', '3:2', '1:1'; defaults to '3:2'
    aspect_ratio: Optional[str] = "3:2"
    # filename: Optional string for base filename (without extension); if provided, images saved as {filename}_1.png, etc.; defaults to task_id if not provided
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
        # Validate aspect_ratio
        if inputs.aspect_ratio is not None and inputs.aspect_ratio not in ["2:3", "3:2", "1:1"]:
            output.status = "error: aspect_ratio must be one of '2:3', '3:2', '1:1' or empty (default '3:2')"
            return output

        model = "grok-imagine/text-to-image"
        base_url = "https://api.kie.ai/api/v1/jobs"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task
        create_url = f"{base_url}/createTask"
        effective_aspect = inputs.aspect_ratio or "3:2"
        payload = {
            "model": model,
            "input": {
                "prompt": inputs.prompt,
                "aspect_ratio": effective_aspect
            }
        }

        response = requests.post(create_url, headers=headers, json=payload)
        result = response.json()
        if result.get("code") != 200:
            output.status = f"error: Failed to create task - {result.get('message', 'Unknown error')}"
            return output

        task_id = result["data"]["taskId"]
        output.task_id = task_id

        # Determine base name for filenames
        if inputs.filename:
            base_name = os.path.splitext(inputs.filename)[0]
        else:
            base_name = task_id

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
                    for i, download_url in enumerate(image_urls, start=1):
                        filename = f"{base_name}_{i}.png"
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

            time.sleep(config.polling_interval)

        if not poll_success:
            output.status = f"error: Task timed out after {config.max_duration} seconds"
            return output

    except Exception as e:
        output.status = f"error: {str(e)}"
        return output

    return output