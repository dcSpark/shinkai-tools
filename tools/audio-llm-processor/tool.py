# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Dict, Optional
from shinkai_local_tools import shinkai_llm_prompt_processor

class CONFIG:
    llm_provider: Optional[str] = None

class INPUTS:
    audio_path: str
    prompt: str
    llm_override: Optional[str] = None

class OUTPUT:
    message: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    
    llm_to_use = inputs.llm_override or config.llm_provider
    
    input_data: Dict[str, Any] = {
        "format": "text",
        "prompt": inputs.prompt,
        "image_paths": [inputs.audio_path]  # Repurpose for audio file
    }
    
    if llm_to_use:
        input_data["llm_provider"] = llm_to_use
    
    result = await shinkai_llm_prompt_processor(input_data)
    output.message = result["message"]
    
    return output