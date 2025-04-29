# /// script
# requires-python = ">=3.10,<3.12"
# dependencies = [
#   "requests",
#   "faster-whisper",
#   "asyncio",
# ]
# ///
import asyncio
from tool import CONFIG, INPUTS, run


def test_basic():
    config = CONFIG()
    inputs = INPUTS()
    inputs.audio_file_path = "tests_data_physicsworks.wav"
    result = asyncio.run(run(config, inputs))
    print(result.transcript)

test_basic()