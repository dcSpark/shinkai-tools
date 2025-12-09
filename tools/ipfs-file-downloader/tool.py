# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import List, Optional, Set
import os
import requests
import mimetypes
from shinkai_local_support import get_home_path

class CONFIG:
    max_file_size_mb: int = 50
    allowed_extensions: str = (
        # Images
        ".jpg, .jpeg, .png, .gif, .webp, .svg, .bmp, .tiff, .ico, .heic, "
        # Documents
        ".pdf, .txt, .md, .rtf, .csv, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .epub, "
        # Web / Data
        ".json, .xml, .yaml, .html, .css, "
        # Audio
        ".mp3, .wav, .ogg, .m4a, .flac, "
        # Video
        ".mp4, .webm, .mkv, .mov, .avi, "
        # Archives (Optional - remove if you want to inspect content first)
        ".zip, .tar, .gz, .rar, .7z"
    )

# INPUTS:
#   ipfs_urls: List[str]
#       List of IPFS URLs to download. Can be 'ipfs://<cid>' or gateway URLs.
#   folder_path: Optional[str]
#       Optional absolute local path to save a duplicate copy of the downloaded files.
#   base_filename: Optional[str]
#       Optional base filename (without extension) to rename the downloaded files.
#       If multiple files are downloaded, suffixes (_1, _2, etc.) will be added.

class INPUTS:
    ipfs_urls: List[str]
    folder_path: Optional[str] = None
    base_filename: Optional[str] = None

# OUTPUT:
#   local_saved_ipfs_files_paths: List[str]
#       List of absolute paths to the saved files. 
#       If 'folder_path' is provided and successful, these will be the paths inside that folder.
#       Otherwise, they will be the paths in the home directory.

class OUTPUT:
    local_saved_ipfs_files_paths: List[str]

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    # --- 1. Pre-Flight Validation ---
    errors = []
    
    # Config Validation
    if config.max_file_size_mb <= 0:
        errors.append(f"CONFIG Error: 'max_file_size_mb' must be > 0. Got: {config.max_file_size_mb}")
        
    # Input Validation: IPFS URLs
    # Check if None, Empty List, or List containing only empty strings
    if inputs.ipfs_urls is None or len(inputs.ipfs_urls) == 0 or not any(url.strip() for url in inputs.ipfs_urls):
        errors.append("INPUTS Error: No IPFS URLs provided. Please provide at least one valid URL in 'ipfs_urls'.")

    # Input Validation: Folder Path
    if inputs.folder_path:
        # Check for characters that are generally unsafe or invalid in paths across common filesystems
        invalid_chars = '<>"|?*'
        if any(c in inputs.folder_path for c in invalid_chars):
             errors.append(f"INPUTS Error: 'folder_path' contains invalid characters: {invalid_chars}")
    
    if errors:
        print("Execution Aborted due to Validation Errors:")
        for e in errors:
            print(f" - {e}")
        output = OUTPUT()
        output.local_saved_ipfs_files_paths = []
        return output

    # --- End Validation ---

    home_path = await get_home_path()
    saved_paths: List[str] = []
    
    # Process Configuration
    max_size_bytes = config.max_file_size_mb * 1024 * 1024
    
    # Normalize allowed extensions: lowercase, strip whitespace
    allowed_exts: Set[str] = {
        ext.strip().lower() 
        for ext in config.allowed_extensions.split(',') 
        if ext.strip()
    }
    
    # Define Gateways
    gateways = [
        "https://ipfs.io/ipfs/",
        "https://dweb.link/ipfs/",
        "https://gateway.pinata.cloud/ipfs/",
        "https://cloudflare-ipfs.com/ipfs/",
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/91.0.4472.124 Safari/537.36'
    }

    # Helper to map common content types if mimetypes fails or is incomplete
    extra_mime_map = {
        # Images
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'image/heic': '.heic',
        # Docs
        'application/pdf': '.pdf',
        'text/plain': '.txt',
        'text/markdown': '.md',
        'text/csv': '.csv',
        'application/epub+zip': '.epub',
        # Microsoft Office (Often tricky with mimetypes lib)
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
        # Data
        'application/json': '.json',
        'application/xml': '.xml',
        'text/yaml': '.yaml',
        # Media
        'video/mp4': '.mp4',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
    }

    total_files = len(inputs.ipfs_urls)

    for index, url in enumerate(inputs.ipfs_urls, start=1):
        if not url or not url.strip():
            continue

        print(f"Processing ({index}/{total_files}): {url}")
        
        # 1. Parse CID / Clean URL
        clean_url = url.strip()
        cid_path = ""
        if clean_url.startswith('ipfs://'):
            cid_path = clean_url[7:].lstrip('/')
        elif 'ipfs/' in clean_url:
            # Try to extract from standard gateway url structure
            parts = clean_url.split('ipfs/')
            if len(parts) > 1:
                cid_path = parts[-1]
        
        # If extraction failed, assume the whole string might be the CID/path
        if not cid_path:
            cid_path = clean_url

        # Remove query parameters for processing
        cid_path_clean = cid_path.split('?')[0]
        
        if not cid_path_clean:
            print(f"  Skipping invalid URL format: {url}")
            continue

        file_saved = False
        
        # 2. Try Gateways
        for gateway in gateways:
            target_url = f"{gateway}{cid_path}"
            
            try:
                # Stream the request
                with requests.get(target_url, headers=headers, stream=True, timeout=20) as r:
                    if r.status_code != 200:
                        # print(f"  -> Gateway {gateway} returned {r.status_code}")
                        continue
                    
                    # 2.1 Check Content-Length header if present
                    content_length = r.headers.get('content-length')
                    if content_length:
                        try:
                            if int(content_length) > max_size_bytes:
                                print(f"  -> File too large ({int(content_length)} bytes). Skipping.")
                                break 
                        except ValueError:
                            pass

                    # 2.2 Determine Extension
                    # Priority: URL extension -> Content-Type mapping
                    original_basename = os.path.basename(cid_path_clean)
                    _, ext = os.path.splitext(original_basename)
                    
                    # If URL has no extension, try Content-Type
                    if not ext:
                        content_type = r.headers.get('content-type', '').split(';')[0].strip().lower()
                        ext = mimetypes.guess_extension(content_type)
                        if not ext:
                            ext = extra_mime_map.get(content_type, "")
                    
                    # Normalize extension
                    if ext:
                        ext = ext.lower()
                    else:
                        ext = "" # Unknown extension

                    # 2.3 Enforce Allowed Extensions
                    if ext not in allowed_exts:
                        print(f"  -> Extension '{ext}' not allowed. Content-Type: {r.headers.get('content-type')}")
                        break 
                    
                    # 2.4 Construct Filename
                    if inputs.base_filename:
                        # Use provided filename
                        if total_files > 1:
                            # Add suffix if multiple files
                            final_name_base = f"{inputs.base_filename}_{index}"
                        else:
                            final_name_base = inputs.base_filename
                        
                        final_filename = f"{final_name_base}{ext}"
                    else:
                        # Use original name logic
                        final_filename = f"{original_basename}{ext}" if ext not in original_basename else original_basename
                        
                        # Fallback if empty
                        if not final_filename or final_filename == ext:
                            final_filename = f"downloaded_file_{index}{ext}"

                    # Sanitize filename
                    final_filename = "".join([c for c in final_filename if c.isalnum() or c in (' ', '.', '-', '_')]).strip()

                    local_file_path = os.path.join(home_path, final_filename)
                    
                    # 2.5 Stream Download with Size Limit
                    downloaded_size = 0
                    success_download = True
                    
                    with open(local_file_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                downloaded_size += len(chunk)
                                if downloaded_size > max_size_bytes:
                                    print(f"  -> File exceeded size limit of {config.max_file_size_mb}MB during download. Aborting.")
                                    success_download = False
                                    break
                                f.write(chunk)
                    
                    if not success_download:
                        # Cleanup partial file
                        if os.path.exists(local_file_path):
                            os.remove(local_file_path)
                        break # Stop trying gateways for this file, it's too big.

                    print(f"  -> Success via {gateway}")
                    
                    # 2.6 Handle Optional Folder Copy and Output Path Selection
                    final_path_to_report = local_file_path
                    
                    if inputs.folder_path:
                        try:
                            os.makedirs(inputs.folder_path, exist_ok=True)
                            dest_path = os.path.join(inputs.folder_path, final_filename)
                            
                            # Copy file (read/write to avoid re-downloading)
                            with open(local_file_path, 'rb') as src, open(dest_path, 'wb') as dst:
                                while True:
                                    b = src.read(1024*1024)
                                    if not b:
                                        break
                                    dst.write(b)
                            print(f"  -> Copied to {dest_path}")
                            final_path_to_report = dest_path
                        except Exception as e:
                            print(f"  -> Failed to copy to folder path: {e}")
                            # If copy fails, we still have the home file, so we report that or stick with it.
                            # final_path_to_report remains local_file_path

                    saved_paths.append(final_path_to_report)
                    file_saved = True
                    break # Break gateway loop on success

            except requests.exceptions.RequestException as e:
                # print(f"  -> Error with {gateway}: {e}")
                pass
            except Exception as e:
                print(f"  -> Unexpected error with {gateway}: {e}")
                pass
        
        if not file_saved:
            print(f"Failed to download {url}")

    output = OUTPUT()
    output.local_saved_ipfs_files_paths = saved_paths
    return output