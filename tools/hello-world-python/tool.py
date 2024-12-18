# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict

class CONFIG:
    pass

class INPUTS:
    pass

class OUTPUT:
    message: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.message = "Hello, World!"
    return output