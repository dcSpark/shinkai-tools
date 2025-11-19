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
    # prompt: Required string, detailed description of the image in English only
    prompt: str
    # aspectRatio: Optional string, must be one of '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'; defaults to '16:9'
    aspectRatio: Optional[str] = "16:9"
    # outputFormat: Optional string, must be 'jpeg' or 'png'; defaults to 'jpeg'
    outputFormat: Optional[str] = "jpeg"
    # model: Optional string, must be 'flux-kontext-pro' or 'flux-kontext-max'; defaults to 'flux-kontext-pro'
    model: Optional[str] = "flux-kontext-pro"
    # improve_prompt: Optional boolean, enables prompt upsampling (may increase time); defaults to False
    improve_prompt: Optional[bool] = False
    # safetyTolerance: Optional integer, moderation level 0 (strict) to 6 (permissive); defaults to 6
    safetyTolerance: Optional[int] = 6
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
        # Validate aspectRatio
        allowed_ratios = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]
        effective_ratio = inputs.aspectRatio if inputs.aspectRatio else "16:9"
        if effective_ratio not in allowed_ratios:
            output.status = f"error: aspectRatio must be one of {allowed_ratios} or empty (default '16:9')"
            return output

        # Validate outputFormat
        allowed_formats = ["jpeg", "png"]
        effective_format = inputs.outputFormat if inputs.outputFormat else "jpeg"
        if effective_format not in allowed_formats:
            output.status = f"error: outputFormat must be one of {allowed_formats} or empty (default 'jpeg')"
            return output

        # Validate model
        allowed_models = ["flux-kontext-pro", "flux-kontext-max"]
        effective_model = inputs.model if inputs.model else "flux-kontext-pro"
        if effective_model not in allowed_models:
            output.status = f"error: model must be one of {allowed_models} or empty (default 'flux-kontext-pro')"
            return output

        # Validate safetyTolerance
        effective_tolerance = inputs.safetyTolerance if inputs.safetyTolerance is not None else 6
        if not isinstance(effective_tolerance, int) or effective_tolerance < 0 or effective_tolerance > 6:
            output.status = "error: safetyTolerance must be an integer 0-6 or empty (default 6)"
            return output

        # Effective improve_prompt
        effective_improve = inputs.improve_prompt if inputs.improve_prompt is not None else False

        base_url = "https://api.kie.ai/api/v1/flux/kontext"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task
        create_url = f"{base_url}/generate"
        payload = {
            "prompt": inputs.prompt,
            "uploadCn": False,
            "aspectRatio": effective_ratio,
            "outputFormat": effective_format,
            "promptUpsampling": effective_improve,
            "model": effective_model,
            "safetyTolerance": effective_tolerance
        }

        response = requests.post(create_url, headers=headers, json=payload)
        if response.status_code != 200:
            try:
                result = response.json()
                msg = result.get("msg", "Unknown error")
            except:
                msg = f"HTTP {response.status_code}"
            output.status = f"error: Failed to create task - {msg}"
            return output

        result = response.json()
        if result.get("code") != 200:
            output.status = f"error: Failed to create task - {result.get('msg', 'Unknown error')}"
            return output

        task_id = result["data"]["taskId"]
        output.task_id = task_id

        # Poll for completion
        query_url = f"{base_url}/record-info"
        start_time = time.time()
        poll_success = False

        while time.time() - start_time < config.max_duration:
            qresponse = requests.get(query_url, headers={"Authorization": f"Bearer {config.api_key}"}, params={"taskId": task_id})
            if qresponse.status_code != 200:
                try:
                    qresult = qresponse.json()
                    msg = qresult.get("msg", "Unknown error")
                except:
                    msg = f"HTTP {qresponse.status_code}"
                output.status = f"error: Failed to query task - {msg}"
                return output

            qresult = qresponse.json()
            if qresult.get("code") != 200:
                output.status = f"error: Failed to query task - {qresult.get('msg', 'Unknown error')}"
                return output

            data = qresult["data"]
            success_flag = data.get("successFlag", -1)
            if success_flag == 1:
                response_data = data.get("response", {})
                image_url = response_data.get("resultImageUrl")
                if image_url:
                    output.temporary_image_urls = [image_url]
                else:
                    output.status = "success: No images generated"
                    poll_success = True
                    break

                # Download and save image
                download_success = True
                if image_url:
                    home_path = await get_home_path()
                    local_paths = []
                    ext = effective_format
                    base_name = inputs.filename if inputs.filename is not None else task_id
                    base_name = os.path.splitext(base_name)[0]  # Sanitize: remove extension if present
                    for i, download_url in enumerate(output.temporary_image_urls, start=1):
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
                            output.status = f"error: Failed to download image {i} - {str(dl_e)}"
                            # Since single image, treat as full failure
                            return output  # Early return on download fail for single image
                    output.saved_images_paths = local_paths
                    if download_success:
                        output.status = "success"
                poll_success = True
                break
            elif success_flag in [2, 3]:
                error_msg = data.get("errorMessage", "Unknown failure")
                output.status = f"error: Task failed - {error_msg}"
                return output
            elif success_flag != 0:
                output.status = f"error: Unexpected successFlag - {success_flag}"
                return output

            # Continue polling if 0 (generating)
            time.sleep(config.polling_interval or 5)

        if not poll_success:
            output.status = f"error: Task timed out after {config.max_duration} seconds"
            return output

    except Exception as e:
        output.status = f"error: {str(e)}"
        return output

    return output