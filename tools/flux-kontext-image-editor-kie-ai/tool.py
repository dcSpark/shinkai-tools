# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import List, Optional
import requests
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
    # prompt: Required string, detailed description of the edits in English only
    prompt: str
    # input_image_path: Required string, local path to the input image for editing; accepted types: image/jpeg, image/png, image/webp
    input_image_path: str
    # enableTranslation: Optional boolean, enables automatic translation of non-English prompts to English; defaults to True
    enableTranslation: Optional[bool] = True
    # aspectRatio: Optional string, must be one of '21:9', '16:9', '4:3', '1:1', '3:4', '9:16' or empty/None to preserve original; defaults to None
    aspectRatio: Optional[str] = None
    # outputFormat: Optional string, must be 'jpeg' or 'png'; defaults to 'jpeg'
    outputFormat: Optional[str] = "jpeg"
    # model: Optional string, must be 'flux-kontext-pro' or 'flux-kontext-max'; defaults to 'flux-kontext-pro'
    model: Optional[str] = "flux-kontext-pro"
    # improve_prompt: Optional boolean, enables prompt upsampling (may increase time); defaults to False
    improve_prompt: Optional[bool] = False
    # safetyTolerance: Optional integer, moderation level 0 (strict) to 2 (permissive) for editing; defaults to 2
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
        # Validate required inputs
        if not inputs.prompt or not inputs.input_image_path:
            output.status = "error: prompt and input_image_path are required"
            return output

        # Validate input_image_path
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
        if not os.path.exists(inputs.input_image_path) or not os.path.isfile(inputs.input_image_path):
            output.status = f"error: Invalid path or not a file: {inputs.input_image_path}"
            return output
        _, ext = os.path.splitext(inputs.input_image_path.lower())
        if ext not in allowed_extensions:
            output.status = f"error: Unsupported file extension for {inputs.input_image_path}; must be .jpg, .jpeg, .png, or .webp"
            return output

        # Upload local image to get URL
        upload_base_url = "https://kieai.redpandaai.co/api/file-stream-upload"
        upload_path = "images/user-uploads"
        auth_header = {"Authorization": f"Bearer {config.api_key}"}
        basename = os.path.basename(inputs.input_image_path)
        mime_type, _ = mimetypes.guess_type(inputs.input_image_path)
        if mime_type is None:
            mime_type = "application/octet-stream"
        try:
            with open(inputs.input_image_path, 'rb') as f:
                files = {'file': (basename, f, mime_type)}
                data = {
                    'uploadPath': upload_path,
                    'fileName': basename
                }
                upload_response = requests.post(upload_base_url, data=data, files=files, headers=auth_header)
            if upload_response.status_code != 200:
                output.status = f"error: HTTP {upload_response.status_code} uploading {inputs.input_image_path} - {upload_response.text[:200]}"
                return output
            try:
                upload_result = upload_response.json()
            except:
                output.status = f"error: Invalid JSON response uploading {inputs.input_image_path} - {upload_response.text[:200]}"
                return output
            if not upload_result.get("success") or upload_result.get("code") != 200:
                msg = upload_result.get("msg", "Unknown error")
                code = upload_result.get("code", "unknown")
                output.status = f"error: Upload failed for {inputs.input_image_path} - code {code}, msg: {msg}"
                return output
            effective_input_image = upload_result.get("data", {}).get("downloadUrl")
            if not effective_input_image:
                output.status = f"error: No download URL returned for {inputs.input_image_path}"
                return output
        except Exception as upload_e:
            output.status = f"error: Exception uploading {inputs.input_image_path} - {str(upload_e)}"
            return output

        # Validate aspectRatio if provided and non-empty
        allowed_ratios = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]
        aspect_input = inputs.aspectRatio or ""
        stripped = aspect_input.strip()
        if stripped:
            if stripped not in allowed_ratios:
                output.status = f"error: aspectRatio must be one of {allowed_ratios} or empty/None (default None to preserve original)"
                return output
            effective_ratio = stripped
        else:
            effective_ratio = None

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

        # Validate safetyTolerance for editing
        effective_tolerance = inputs.safetyTolerance if inputs.safetyTolerance is not None else 6
        if not isinstance(effective_tolerance, int) or effective_tolerance < 0 or effective_tolerance > 6:
            output.status = "error: safetyTolerance must be an integer 0-6 or empty (default 6) for editing"
            return output

        # Effective values
        effective_improve = inputs.improve_prompt if inputs.improve_prompt is not None else False
        effective_enable_translation = inputs.enableTranslation if inputs.enableTranslation is not None else True

        base_url = "https://api.kie.ai/api/v1/flux/kontext"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}"
        }

        # Create task for editing
        create_url = f"{base_url}/generate"
        payload = {
            "prompt": inputs.prompt,
            "inputImage": effective_input_image,
            "enableTranslation": effective_enable_translation,
            "uploadCn": False,
            "outputFormat": effective_format,
            "promptUpsampling": effective_improve,
            "model": effective_model,
            "safetyTolerance": effective_tolerance
        }
        if effective_ratio is not None:
            payload["aspectRatio"] = effective_ratio

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

                # Download and save image (single image for editing)
                download_success = True
                if image_url:
                    home_path = await get_home_path()
                    local_paths = []
                    ext = effective_format
                    base_name = inputs.filename if inputs.filename is not None else task_id
                    base_name = os.path.splitext(base_name)[0]  # Sanitize: remove extension if present
                    filename = f"{base_name}.{ext}"
                    local_path = os.path.join(home_path, filename)
                    try:
                        dl_response = requests.get(image_url, stream=True)
                        dl_response.raise_for_status()
                        with open(local_path, 'wb') as f:
                            for chunk in dl_response.iter_content(chunk_size=8192):
                                f.write(chunk)
                        local_paths.append(local_path)
                    except Exception as dl_e:
                        download_success = False
                        output.status = f"error: Failed to download image - {str(dl_e)}"
                        return output  # Early return on download fail
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