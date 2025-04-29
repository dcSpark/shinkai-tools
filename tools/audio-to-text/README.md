# Text to Audio Transcription Tool

This tool transcribes audio files to text using the [faster-whisper](https://github.com/SYSTRAN/faster-whisper) model, which is a faster implementation of OpenAI's Whisper model using CTranslate2.

## Features

- Transcribe audio files to text with high accuracy
- Support for multiple model sizes (tiny, small, base, medium, large-v2)
- Configurable device (CPU or CUDA) and compute type (int8, float16, float32)
- Simple API for integration into other applications

### Parameters

- `CONFIG` - Configuration object that controls the model behavior
  - `model_name: str` - The size of the Whisper model to use (default: "base")
  - `device: str` - The device to run the model on (default: "cpu")
  - `compute_type: str` - The compute type to use for the model (default: "float32")

- `INPUTS` - Input object containing the audio file path
  - `audio_file_path: str` - The path to the audio file to transcribe

### Return Value

- `OUTPUT` Object containing the transcription result
  - `transcript: str` - The transcribed text from the audio file

### Configuration Options

#### Model Size

The `model_name` parameter determines the size and accuracy of the Whisper model:

- `tiny`: Fastest, lowest accuracy
- `small`: Good balance of speed and accuracy
- `base`: Default option, good accuracy
- `medium`: Higher accuracy, slower
- `large-v2`: Highest accuracy, slowest

#### Device

The `device` parameter determines where the model runs:

- `cpu`: Run on CPU (works on all systems)
- `cuda`: Run on GPU (requires NVIDIA GPU with CUDA support)

#### Compute Type

The `compute_type` parameter determines the precision used for computation:

- `int8`: Fastest on CPU, uses 8-bit quantization
- `float16`: Fastest on GPU, uses 16-bit floating point
- `float32`: Highest precision, uses 32-bit floating point

## Performance Considerations

- For CPU usage, `int8` compute type is recommended for best performance
- For GPU usage, `float16` compute type is recommended for best performance
- Larger models provide better accuracy but require more memory and processing power
- The first run may take longer as the model needs to be downloaded

## Limitations

- Transcription quality depends on audio quality and the selected model size
- GPU acceleration requires a compatible NVIDIA GPU with CUDA support

