# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List
import requests
import webbrowser

class CONFIG:
    api_key: str
    default_width: str
    default_height: str

class INPUTS:
    prompt: str  # string, required, length ≤ 2048
    width: Optional[int] = None  # integer 256 to 1280, must be multiple of 8
    height: Optional[int] = None # integer 256 to 1280, must be multiple of 8
    steps: Optional[int] = 4  # integer 1 to 6
    output_format: Optional[str] = "jpeg" # string, either jpeg or png

class OUTPUT:
    response_image_generated: str
    remaining_balance: Optional[float] = None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    api_url = "https://api.getimg.ai/v1/flux-schnell/text-to-image"
    
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"Bearer {config.api_key}"
    }
    
    payload = {
        "prompt": inputs.prompt,
        "response_format": "url",
        "width": int(inputs.width) if inputs.width is not None else int(config.default_width),
        "height": int(inputs.height) if inputs.height is not None else int(config.default_height),
        "steps": inputs.steps,
        "output_format": inputs.output_format
    }

    response = requests.post(api_url, json=payload, headers=headers)

    output = OUTPUT()
    
    if response.status_code == 200:
        response_data = response.json()
        image_url = response_data.get("url", "")
        if image_url:
            webbrowser.open(image_url)
        output.response_image_generated = image_url
    else:
        if response.status_code == 400:
            output.response_image_generated = "Error 400: Bad Request - Invalid request parameter."
        elif response.status_code == 401:
            output.response_image_generated = "Error 401: Unauthorized - Invalid API Key provided."
        elif response.status_code == 402:
            output.response_image_generated = "Error 402: Payment Required - Quota exceeded."
        elif response.status_code == 429:
            output.response_image_generated = "Error 429: Too Many Requests - Too many requests hit the API too quickly."
        elif response.status_code == 404:
            output.response_image_generated = "Error 404: Not Found - The resource doesn't exist."
        elif response.status_code == 500:
            output.response_image_generated = "Error 500: Server Error - Something went wrong on our end."
        else:
            output.response_image_generated = f"Error: HTTP Status Code {response.status_code}"

    balance_url = "https://api.getimg.ai/v1/account/balance"
    balance_headers = {
        "accept": "application/json",
        "authorization": f"Bearer {config.api_key}"
    }
    balance_response = requests.get(balance_url, headers=balance_headers)

    if balance_response.status_code == 200:
        balance_data = balance_response.json()
        output.remaining_balance = balance_data.get("amount")

    return output