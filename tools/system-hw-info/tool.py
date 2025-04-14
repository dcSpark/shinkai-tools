# /// script
# dependencies = [
# "psutil>=5.9.0"
# ]
# ///
import psutil
import platform
from typing import List, Optional
import subprocess
import json

class CONFIG:
    pass

class INPUTS:
    pass

class OUTPUT:
    cpu_info: dict
    memory_info: dict
    disk_info: dict
    gpu_info: List[dict]
    system_info: dict

def get_mac_model() -> str:
    try:
        result = subprocess.run(['sysctl', 'hw.model'], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.split(':')[1].strip()
    except:
        pass
    return "Unknown Mac Model"

def get_gpu_info() -> List[dict]:
    """Get GPU information based on the current platform."""
    try:
        system = platform.system().lower()
        if system == "darwin":
            # macOS - use system_profiler
            try:
                result = subprocess.run(
                    ['system_profiler', 'SPDisplaysDataType', '-json'],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    data = json.loads(result.stdout)
                    gpu_info = []
                    for gpu in data.get('SPDisplaysDataType', []):
                        gpu_info.append({
                            "name": gpu.get('sppci_model', 'Unknown GPU'),
                            "vendor": gpu.get('sppci_vendor', 'Unknown'),
                            "memory_total": gpu.get('spdisplays_vram', 'Unknown'),
                            "metal_supported": gpu.get('sppci_metal', 'Unknown'),
                            "displays": gpu.get('spdisplays_ndrvs', [])
                        })
                    return gpu_info
            except:
                pass
        elif system == "linux":
            # Linux - use lspci
            try:
                result = subprocess.run(
                    ['lspci', '-v', '-mm'],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    gpu_info = []
                    for line in result.stdout.split('\n'):
                        if 'VGA' in line or '3D' in line:
                            parts = line.split('"')
                            if len(parts) > 3:
                                gpu_info.append({
                                    "name": parts[3],
                                    "vendor": parts[1],
                                    "type": "Discrete" if '3D' in line else "Integrated"
                                })
                    return gpu_info
            except:
                pass
        elif system == "windows":
            # Windows - use wmic
            try:
                result = subprocess.run(
                    ['wmic', 'path', 'win32_VideoController', 'get', '/format:csv'],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    gpu_info = []
                    lines = result.stdout.strip().split('\n')[1:]  # Skip header
                    for line in lines:
                        if line.strip():
                            parts = line.split(',')
                            if len(parts) > 2:
                                gpu_info.append({
                                    "name": parts[1],
                                    "driver_version": parts[2],
                                    "video_memory": parts[3] if len(parts) > 3 else "Unknown"
                                })
                    return gpu_info
            except:
                pass

    except Exception as e:
        pass

    # Fallback when no GPU info could be retrieved
    return [{"name": "Integrated Graphics", "details": "No GPU information available"}]

def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    """
    Get detailed system hardware information using psutil and platform.
    
    Args:
        c: Configuration object
        p: Input parameters
    
    Returns:
        OUTPUT: A dictionary containing detailed system hardware information
    """
    try:
        # CPU Information
        cpu_freq = psutil.cpu_freq()
        cpu_info = {
            "physical_cores": psutil.cpu_count(logical=False),
            "logical_cores": psutil.cpu_count(logical=True),
            "frequency": {
                "current_mhz": cpu_freq.current if cpu_freq else None,
                "min_mhz": cpu_freq.min if cpu_freq else None,
                "max_mhz": cpu_freq.max if cpu_freq else None
            },
            "architecture": platform.machine(),
            "processor_brand": platform.processor() or "Unknown",
            "cpu_usage_percent": psutil.cpu_percent(interval=1)
        }

        # Memory Information
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        memory_info = {
            "total_bytes": memory.total,
            "available_bytes": memory.available,
            "used_bytes": memory.used,
            "percent_used": memory.percent,
            "swap": {
                "total_bytes": swap.total,
                "used_bytes": swap.used,
                "free_bytes": swap.free,
                "percent_used": swap.percent
            }
        }

        # Disk Information
        disk = psutil.disk_usage('/')
        disk_info = {
            "total_bytes": disk.total,
            "used_bytes": disk.used,
            "free_bytes": disk.free,
            "percent_used": disk.percent,
            "file_system_type": "Unknown"  # This could be enhanced for specific OS
        }

        # GPU Information using platform-specific approach
        gpu_info = get_gpu_info()

        # System Information
        system_info = {
            "os_name": platform.system(),
            "os_version": platform.version(),
            "os_release": platform.release(),
            "computer_name": platform.node(),
            "machine_type": "Unknown",
            "boot_time": psutil.boot_time()
        }

        # Add Mac-specific information if on macOS
        if platform.system() == "Darwin":
            system_info["machine_type"] = get_mac_model()

        output = OUTPUT()
        output.cpu_info = cpu_info
        output.memory_info = memory_info
        output.disk_info = disk_info
        output.gpu_info = gpu_info
        output.system_info = system_info
        return output

    except Exception as e:
        raise Exception(f"Failed to gather system hardware information: {str(e)}")
