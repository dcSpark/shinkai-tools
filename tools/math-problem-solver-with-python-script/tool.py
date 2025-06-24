# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, Dict
from shinkai_local_tools import shinkai_llm_prompt_processor
import re

class CONFIG:
    max_retries: int = 3

class INPUTS:
    prompt: str

class OUTPUT:
    calculation_result: Any = None
    text_result: Optional[str] = None
    status: str = "error"
    script: Optional[str] = None
    error: Optional[str] = None

def clean_code_snippet(code: str) -> str:
    """
    Remove markdown code block formatting like ```python\n or ``` from the code snippet.
    """
    # Remove leading ```python or ``` with optional newline
    code = re.sub(r"^```(?:python)?\s*", "", code, flags=re.IGNORECASE)
    # Remove trailing ```
    code = re.sub(r"```$", "", code)
    return code.strip()

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()

    base_prompt = (
        "You are a Python script generator specialized in mathematical calculations. "
        "Given a natural language description of a calculation or math expression, generate a clean and valid Python code snippet "
        "that performs the calculation. The code must assign the final result to a variable named 'ans'. "
        "The code can use intermediary calculations, assigning and using intermediaries variables in-between, but the final answer must be a variable named 'ans'."
        "Eventually, intermediary results can be presented as fractions, square roots, etc. if they are not entire number, this way no rounding errors are accumulating through the steps."
        "The code snippet should contain very little comments. Comments must not include any assumptions of results. The code must be very focus on achieving a cacluation."
        "Import the math module if needed. "
        "Output ONLY the Python code snippet, with no extra explanations or text. "
        "Make sure the code is ready for direct execution in a Python environment."
        f"\n\nCalculation request: {inputs.prompt}"
    )

    last_error = None

    for attempt in range(1, config.max_retries + 1):
        if last_error is not None:
            prompt_with_feedback = (
                base_prompt +
                f"\n\nNote: The previous script you generated failed to execute with error: {last_error}\n"
                "Please correct the Python code to fix this error and produce a valid script."
            )
        else:
            prompt_with_feedback = base_prompt

        processor_input = {
            "format": "text",
            "prompt": prompt_with_feedback
        }

        try:
            response = await shinkai_llm_prompt_processor(processor_input)
            raw_script = response.get("message", "").strip()
            if not raw_script:
                raise ValueError("LLM prompt processor returned empty script.")

            script = clean_code_snippet(raw_script)

            env = {
                "math": __import__("math"),
                "abs": abs,
                "round": round,
                "pow": pow,
            }

            exec(script, env)

            result = env.get("ans", None)

            output.calculation_result = result
            output.script = script
            output.status = "success"
            output.error = None
            break

        except Exception as e:
            last_error = f"{type(e).__name__}: {str(e)}"
            output.error = last_error
            output.status = f"error on attempt {attempt}: {last_error}"
            output.script = script if 'script' in locals() else None

            if attempt == config.max_retries:
                output.calculation_result = None
                output.text_result = None
                return output

    if output.status == "success":
        summary_prompt = (
            "You are a helpful assistant. "
            "Given the original user prompt, the python script executed, and the calculation result, "
            "write a short, natural language sentence summarizing the result in context. "
            "Do not repeat the full prompt, keep it concise and informative."
            f"\n\nOriginal prompt: {inputs.prompt}"
            f"\nPython script:\n{script}"
            f"\nCalculation result: {output.calculation_result}"
            "\n\nShort summary:"
        )

        summary_input = {
            "format": "text",
            "prompt": summary_prompt
        }

        try:
            summary_response = await shinkai_llm_prompt_processor(summary_input)
            text_result = summary_response.get("message", "").strip()
            output.text_result = text_result if text_result else None
        except Exception:
            output.text_result = None

    return output