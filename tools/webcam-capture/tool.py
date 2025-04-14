# /// script
# dependencies = [
#     "requests",
#     "numpy==1.26.4",
#     "opencv-python==4.8.0.76"
# ]
# ///

import cv2
import time
import base64
import numpy as np
import os
import platform
from typing import Dict, Any, Optional, List
from shinkai_local_support import get_home_path

class CONFIG:
    cameraIndex: Optional[int]
    format: Optional[str]

class INPUTS:
    width: Optional[int]
    height: Optional[int]

class OUTPUT:
    imagePath: str
    width: int
    height: int

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    """
    Captures a single frame from a local webcam and saves it to disk.
    
    Args:
        config: Configuration with camera index and output format
        inputs: Input parameters with width and height
    Returns:
        OUTPUT object with image path and dimensions
    """
    # Set defaults
    camera_index = getattr(config, 'cameraIndex', 0)
    img_format = getattr(config, 'format', 'png').lower()
    if img_format not in ('png', 'jpeg', 'jpg'):
        img_format = 'png'

    width = getattr(inputs, 'width', 640)
    height = getattr(inputs, 'height', 480)

    # Determine camera source based on platform
    if platform.system() == 'Darwin':  # macOS
        camera_source = camera_index
    else:  # Linux, Windows
        camera_source = camera_index

    # Open the camera
    cap = cv2.VideoCapture(camera_source)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open webcam (index={camera_index}). Please check if the camera is connected and accessible.")

    try:
        # Set resolution
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

        # Let the camera warm up and auto-adjust: grab/discard extra frames
        for _ in range(15):
            _, _ = cap.read()
        
        # Wait a moment so the auto-exposure has time to adapt
        time.sleep(0.5)

        # Try to capture the final frame
        ret, frame = cap.read()
        if not ret or frame is None:
            raise RuntimeError("Failed to capture frame from webcam. Please check camera permissions and settings.")

        # Optional gamma correction for better brightness
        gamma = 1.2  # Adjust this value if needed (>1 brightens, <1 darkens)
        look_up_table = np.array([((i / 255.0) ** (1.0/gamma)) * 255 for i in range(256)]).astype("uint8")
        frame = cv2.LUT(frame, look_up_table)

        # Get final dimensions
        final_height, final_width, _ = frame.shape

        # Get home path for writing file
        home_path = await get_home_path()
        
        # Create filename with timestamp
        timestamp = int(time.time())
        filename = f"webcam_capture_{timestamp}.{img_format}"
        file_path = os.path.join(home_path, filename)

        # Encode and write to file
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95] if img_format.startswith('jp') else []
        result = cv2.imwrite(file_path, frame, encode_param)
        if not result:
            raise RuntimeError("Failed to write image to disk. Please check disk permissions and space.")

        # Create output
        output = OUTPUT()
        output.imagePath = file_path
        output.width = final_width
        output.height = final_height

        return output

    finally:
        # Always release the camera
        cap.release() 