# /// script
# dependencies = [
#   "requests",
#   "PyPDF2",
# ]
# ///

from typing import Optional, List
import requests
import os
from urllib.parse import urlparse, unquote
import re
from PyPDF2 import PdfReader
from shinkai_local_support import get_home_path

class CONFIG:
    pass

class INPUTS:
    url: str

class OUTPUT:
    pdf_file_path: str
    txt_file_path: str
    text_content: str

def sanitize_filename(filename: str) -> str:
    # Remove query parameters
    filename = filename.split('?')[0]
    filename = unquote(filename)
    # Replace any character not allowed in filenames with underscore
    # For most filesystems, allow a-z, A-Z, 0-9, ., _, and -
    filename = re.sub(r'[^A-Za-z0-9._-]', '_', filename)
    return filename

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    # Download PDF from URL
    response = requests.get(inputs.url)
    response.raise_for_status()
    
    # Extract filename from URL path
    parsed_url = urlparse(inputs.url)
    base_name = os.path.basename(parsed_url.path)
    if not base_name:
        # If URL ends with slash or no basename, use default name
        base_name = "downloaded.pdf"
    base_name = sanitize_filename(base_name)
    if not base_name.lower().endswith('.pdf'):
        base_name += ".pdf"
    
    # Create text filename by replacing extension with .txt
    name_without_ext = os.path.splitext(base_name)[0]
    txt_name = name_without_ext + ".txt"
    
    # Get home directory path to save files
    home_dir = await get_home_path()
    
    # Define file paths
    pdf_file_path = os.path.join(home_dir, base_name)
    txt_file_path = os.path.join(home_dir, txt_name)
    
    # Save PDF file
    with open(pdf_file_path, 'wb') as pdf_file:
        pdf_file.write(response.content)
    
    # Extract text from PDF
    pdf_content = ""
    with open(pdf_file_path, 'rb') as pdf_file:
        reader = PdfReader(pdf_file)
        for page in reader.pages:
            pdf_content += page.extract_text() or ""
    
    # Save extracted text to file
    with open(txt_file_path, 'w', encoding='utf-8') as text_file:
        text_file.write(pdf_content)
    
    output = OUTPUT()
    output.pdf_file_path = pdf_file_path
    output.txt_file_path = txt_file_path
    output.text_content = pdf_content
    return output