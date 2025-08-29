# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional
import os
import shutil

class CONFIG:
    pass

class INPUTS:
    source_file_path: str
    target_directory_path: str
    overwrite: Optional[bool] = False

class OUTPUT:
    saved_file_path: Optional[str] = None
    error_message: Optional[str] = None
    new_directory_created: Optional[str] = None

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    try:
        # Validate source file
        if not os.path.isfile(inputs.source_file_path):
            output.error_message = f"Source file not found or is a directory: '{inputs.source_file_path}'"
            return output

        # Check if target directory exists
        if not os.path.exists(inputs.target_directory_path):
            os.makedirs(inputs.target_directory_path)
            output.new_directory_created = inputs.target_directory_path

        # Define destination path
        filename = os.path.basename(inputs.source_file_path)
        destination_path = os.path.join(inputs.target_directory_path, filename)

        # Check overwrite condition
        if os.path.exists(destination_path) and not inputs.overwrite:
            output.error_message = (
                f"Destination file '{destination_path}' already exists. "
                "Set 'overwrite' to True to replace it."
            )
            return output

        # Copy file
        shutil.copy2(inputs.source_file_path, destination_path)
        output.saved_file_path = destination_path
        output.error_message = None
        return output

    except (PermissionError, IsADirectoryError) as e:
        output.error_message = str(e)
        return output
    except Exception as e:
        output.error_message = f"Unexpected error: {str(e)}"
        return output