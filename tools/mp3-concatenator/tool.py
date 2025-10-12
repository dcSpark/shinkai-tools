# /// script
# dependencies = [
#   "requests",
# ]
# ///

import subprocess
import shutil
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from shinkai_local_support import get_home_path

# --- Data Structures for Config, Input and Output ---

class CONFIG:
    """Configuration container (no configuration required for this tool)."""
    pass

class INPUTS:
    """Defines the inputs for the MP3 concatenation tool with home-path saving and free optional path."""
    # A list of absolute paths to the MP3 files you want to join, in order.
    input_files: List[str]
    # Optional: The filename to use for the output saved in the home path (e.g., "final.mp3").
    output_filename: Optional[str] = None
    # Optional: A user-provided path to also save a copy (can be any path on the device).
    optional_output_path: Optional[str] = None

class OUTPUT:
    """Defines the output of the tool."""
    # The final path of the generated MP3 file saved in the home path.
    home_saved_path: str
    # If provided, the path where the additional copy was saved.
    optional_saved_path: Optional[str]
    # A message indicating the result of the operation.
    message: str

# --- Helpers ---

def _ffmpeg_exists() -> bool:
    """Checks if the 'ffmpeg' command is available in the system's PATH."""
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False

def _ensure_mp3_filename(name: str) -> str:
    """Ensure filename has .mp3 extension."""
    p = Path(name)
    if p.suffix.lower() != ".mp3":
        p = p.with_suffix(".mp3")
    return str(p.name)

def _resolve_optional_destination_path(user_path_str: str, default_filename: str) -> Path:
    """
    Resolve user's optional path:
      - If a directory, place default_filename inside it.
      - If a file path, ensure it has .mp3 suffix and use it directly.
      - If it has no suffix and doesn't exist, treat as directory.
    """
    user_path = Path(user_path_str).expanduser()

    if user_path.exists() and user_path.is_dir():
        return (user_path / default_filename).resolve()

    # If it looks like a file path (has suffix), ensure .mp3
    if user_path.suffix:
        if user_path.suffix.lower() != ".mp3":
            user_path = user_path.with_suffix(".mp3")
        return user_path.resolve()

    # No suffix: treat as directory
    return (user_path / default_filename).resolve()

def _concatenate_mp3s_with_ffmpeg(sound_paths: List[str], output_path: Path) -> None:
    """
    Concatenates (joins) multiple audio files into one using ffmpeg.

    Args:
        sound_paths: An ordered list of paths to the audio files to join.
        output_path: The path for the final concatenated MP3.
    """
    cmd = ["ffmpeg", "-y"]

    for file_path in sound_paths:
        cmd += ["-i", str(file_path)]

    concat_inputs = "".join([f"[{idx}:a]" for idx, _ in enumerate(sound_paths)])
    filter_chain = f"{concat_inputs}concat=n={len(sound_paths)}:v=0:a=1[outa]"

    cmd += [
        "-filter_complex", filter_chain,
        "-map", "[outa]",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        str(output_path)
    ]

    subprocess.run(cmd, check=True)

# --- Entry Point ---

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    """The main entry point for the tool."""
    output = OUTPUT()

    # Check ffmpeg availability
    if not _ffmpeg_exists():
        raise RuntimeError(
            "ffmpeg is not found in your system's PATH. "
            "It is required to concatenate audio files. Please install ffmpeg and try again."
        )

    # Validate inputs
    input_files = getattr(inputs, "input_files", None)
    if not input_files or len(input_files) < 2:
        raise ValueError("Please provide at least two MP3 files in 'input_files' to concatenate.")

    # Optional: validate that inputs exist
    for f in input_files:
        p = Path(f).expanduser()
        if not p.exists() or not p.is_file():
            raise ValueError(f"Input file does not exist or is not a file: {f}")

    # Resolve home path (all created files must be written here at least once)
    home_dir_str = await get_home_path()
    home_dir = Path(home_dir_str).expanduser().resolve()
    home_dir.mkdir(parents=True, exist_ok=True)

    # Determine the home output filename
    output_filename = getattr(inputs, "output_filename", None)
    if not output_filename or not isinstance(output_filename, str) or not output_filename.strip():
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        output_filename = f"concatenated_{timestamp}.mp3"
    else:
        output_filename = _ensure_mp3_filename(output_filename.strip())

    home_output_path = (home_dir / output_filename).resolve()

    # Execute concatenation into the home directory
    try:
        _concatenate_mp3s_with_ffmpeg(sound_paths=input_files, output_path=home_output_path)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg failed during the concatenation process: {e}") from e
    except Exception as e:
        raise RuntimeError(f"An unexpected error occurred during concatenation: {e}") from e

    # Handle optional copy to any user path
    optional_saved_path_str = None
    optional_output = getattr(inputs, "optional_output_path", None)
    if optional_output and isinstance(optional_output, str) and optional_output.strip():
        dest_path = _resolve_optional_destination_path(optional_output.strip(), output_filename)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(str(home_output_path), str(dest_path))
            optional_saved_path_str = str(dest_path)
        except Exception as e:
            # Do not fail the main operation if the optional copy fails; report success for the home path
            optional_saved_path_str = None

    # Prepare output
    output.home_saved_path = str(home_output_path)
    output.optional_saved_path = optional_saved_path_str
    if optional_saved_path_str:
        output.message = (
            f"Successfully concatenated {len(input_files)} files. "
            f"Saved at: {str(home_output_path)} and also at: {optional_saved_path_str}"
        )
    else:
        output.message = (
            f"Successfully concatenated {len(input_files)} files. "
            f"Saved at: {str(home_output_path)}"
        )

    return output