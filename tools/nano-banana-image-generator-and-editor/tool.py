# /// script
# dependencies = [
#   "requests",
#   "google-genai",
#   "pillow",
# ]
# ///

from typing import Any, Optional, List, Dict
import os
import datetime
import shutil
from PIL import Image
from google import genai
from google.genai import types

from shinkai_local_support import (
    get_home_path,
)

class CONFIG:
    """
    Configuration for the Gemini Image Generator.
    """
    # Mandatory API Key for Google GenAI.
    google_api_key: str 

class INPUTS:
    # The text description of the image to generate or edit.
    prompt: str
    
    # Model to use: "flash" (Gemini 2.5 - Fast, Efficient) or "pro" (Gemini 3 Pro - High Quality, Reasoning).
    model_selection: str = "flash"
    
    # List of full local file paths to reference images for editing or composition.
    # Flash works best with up to 3 images. Pro supports up to 14.
    reference_image_paths: List[str] = []
    
    # Desired aspect ratio. Options: "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9".
    aspect_ratio: str = "1:1"
    
    # Resolution (Only for Pro model). Options: "1K", "2K", "4K".
    resolution: str = "1K"
    
    # Optional filename for the output image file. If None, a timestamp is used.
    output_filename: Optional[str] = None
    
    # Optional folder name (relative to home or absolute) to save a copy of the image.
    output_folder: Optional[str] = None

class OUTPUT:
    # Full local path where the generated image was saved.
    local_saved_image_path: str
    # The thought process trace from the model (if available, e.g., in Pro model).
    thought_process: Optional[str] = None
    # Details about the execution, including warnings or error messages.
    execution_details: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    """
    Generates or edits a single image using Google's Gemini models (Nano Banana / Nano Banana Pro).
    
    Notes:
    - Generates 1 image per API call.
    - Gemini 2.5 Flash (Nano Banana) is faster.
    - Gemini 3 Pro (Nano Banana Pro) uses a reasoning process ("Thinking") and supports higher resolutions.
    
    Best Practices & Strategies:
    1. Be Hyper-Specific: Describe lighting, camera angles (e.g., "low-angle perspective"), and fine details.
    2. Context & Intent: Explain the purpose (e.g., "Create a logo for a high-end brand").
    3. Iteration: Use the conversational nature to refine (e.g., "Make lighting warmer").
    4. Step-by-Step: For complex scenes, break instructions into steps (Background -> Foreground -> Subject).
    5. Semantic Negative Prompts: Describe what you want positively (e.g., "empty street") rather than "no cars".
    6. Photorealism: Use terms like "85mm lens", "bokeh", "golden hour", "studio-lit".
    7. Text Rendering: Specify font style and placement clearly. Use 'pro' model for best text results.
    """
    output = OUTPUT()
    output.local_saved_image_path = ""
    output.execution_details = ""
    
    # 1. Setup Environment and Auth
    home_path = await get_home_path()
    
    # API Key is mandatory
    if not config.google_api_key:
        raise ValueError("Google Access Token is missing. Please provide it in CONFIG.google_api_key.")

    client = genai.Client(api_key=config.google_api_key)

    # 2. Model Selection and Validation
    # gemini-2.5-flash-image (Nano Banana): Fast, efficient.
    # gemini-3-pro-image-preview (Nano Banana Pro): Reasoning, 4K.
    
    model_id = "gemini-2.5-flash-image"
    if inputs.model_selection.lower() == "pro":
        model_id = "gemini-3-pro-image-preview"
    
    # --- IMAGE INPUT LIMITS & BEST PRACTICES ---
    # Gemini 2.5 Flash Image (Nano Banana):
    # - Works best with up to 3 images as input.
    #
    # Gemini 3 Pro Image Preview (Nano Banana Pro):
    # - Supports up to 14 images in total.
    # - Up to 6 images of objects with high-fidelity.
    # - Up to 5 images of humans to maintain character consistency.
    # -------------------------------------------
    
    # Validate Image Counts
    img_count = len(inputs.reference_image_paths)
    
    if inputs.model_selection.lower() == "flash":
        if img_count > 3:
            output.execution_details += f"Warning: You provided {img_count} images. Gemini 2.5 Flash works best with up to 3 images.\n"
    elif inputs.model_selection.lower() == "pro":
        if img_count > 14:
            raise ValueError(f"Pro model supports maximum 14 reference images. You provided {img_count}.")

    # 3. Prepare Content (Prompt + Images)
    contents = [inputs.prompt]
    
    # Load reference images
    opened_images = []
    for path in inputs.reference_image_paths:
        if os.path.exists(path):
            try:
                img = Image.open(path)
                contents.append(img)
                opened_images.append(img) # Keep reference to close later if needed
            except Exception as e:
                output.execution_details += f"Error loading image {path}: {str(e)}\n"
        else:
            output.execution_details += f"Image path not found: {path}\n"

    # 4. Configure Generation
    # Validate Resolution (Must be uppercase K)
    resolution_param = inputs.resolution.upper() if inputs.resolution else "1K"
    if resolution_param not in ["1K", "2K", "4K"]:
        resolution_param = "1K" # Default fallback
        
    image_config_args = {
        "aspect_ratio": inputs.aspect_ratio if inputs.aspect_ratio else "1:1",
    }
    
    # Resolution is only for Pro model
    if inputs.model_selection.lower() == "pro":
        image_config_args["image_size"] = resolution_param

    gen_config_args = {
        "response_modalities": ["TEXT", "IMAGE"], # Request both to capture thoughts and image
        "image_config": types.ImageConfig(**image_config_args)
    }

    config_obj = types.GenerateContentConfig(**gen_config_args)

    # 5. Execute Generation
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=contents,
            config=config_obj
        )
    except Exception as e:
        raise Exception(f"API Call Failed: {str(e)}")

    # 6. Process Response
    
    # Determine save locations
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    base_filename = inputs.output_filename if inputs.output_filename else f"gen_{timestamp}"
    
    # Ensure optional output folder exists if provided
    custom_folder_path = None
    if inputs.output_folder:
        # If absolute path, use it. If relative, join with home.
        if os.path.isabs(inputs.output_folder):
            custom_folder_path = inputs.output_folder
        else:
            custom_folder_path = os.path.join(home_path, inputs.output_folder)
        
        if not os.path.exists(custom_folder_path):
            try:
                os.makedirs(custom_folder_path)
            except OSError:
                output.execution_details += f"Could not create custom folder {custom_folder_path}. Using home only.\n"
                custom_folder_path = None

    image_generated = False
    collected_thoughts = []
    
    if response and response.parts:
        for part in response.parts:
            # Handle Thoughts (Pro model feature)
            if part.text:
                if hasattr(part, 'thought') and part.thought:
                    collected_thoughts.append(part.text)
                # General text content is ignored

            # Handle Image (inline_data)
            # We expect only 1 image.
            if part.inline_data and not image_generated:
                try:
                    generated_image = part.as_image()
                    
                    # 1. Save to Home Path (Primary requirement)
                    filename = f"{base_filename}.png"
                    home_file_path = os.path.join(home_path, filename)
                    generated_image.save(home_file_path)
                    
                    final_path = home_file_path

                    # 2. Save to Custom Folder (If provided)
                    if custom_folder_path:
                        custom_file_path = os.path.join(custom_folder_path, filename)
                        generated_image.save(custom_file_path)
                        # Preference to show the custom folder path in output
                        final_path = custom_file_path
                    
                    output.local_saved_image_path = final_path
                    image_generated = True
                except Exception as img_e:
                    output.execution_details += f"Failed to save the image part: {str(img_e)}\n"

    if collected_thoughts:
        output.thought_process = "\n".join(collected_thoughts)

    if image_generated:
        output.execution_details += f"Generated 1 image using model {model_id}."
    else:
        output.execution_details += "No image was generated in the response."
    
    return output