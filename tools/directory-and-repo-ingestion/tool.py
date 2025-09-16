# /// script
# dependencies = [
#   "requests",
#   "tiktoken",
# ]
# ///
from typing import Any, Optional, List, Tuple
import os
import re
import subprocess
import tempfile
import shutil
from urllib.parse import urlparse
from dataclasses import dataclass
from shinkai_local_support import get_home_path
import tiktoken

class CONFIG:
    export_format: Optional[str] = "md"  # 'md' or 'txt'

class INPUTS:
    directory_path: str # Can be a local path or a GitHub URL
    output_file: Optional[str] = "ingested_directory" # Just the base name, extension is added automatically
    max_file_size_kb: Optional[int] = 100
    ignore_dirs: Optional[List[str]] = None
    ignore_extensions: Optional[List[str]] = None
    code_extensions: Optional[List[str]] = None

@dataclass
class OUTPUT:
    ingested_output: Optional[str] # The primary output with Summary, Tree, and all file content
    output_path: str
    token_count: Any
    file_size_display: str

def default_ignored_directories() -> List[str]:
    return [".git", "node_modules", "__pycache__", ".venv", "venv", ".idea", ".vscode", ".Rproj.user"]

def default_ignored_file_extensions() -> List[str]:
    return [
        ".pyc", ".pyo", ".pyd", ".class", ".jar", ".war", ".ear", ".nar", ".o", ".obj",
        ".dll", ".dylib", ".exe", ".lib", ".out", ".a", ".pdb", ".xcodeproj",
        ".xcworkspace", ".pbxuser", ".mode1v3", ".mode2v3", ".perspectivev3",
        ".xcuserstate", ".gem", ".bundle", ".suo", ".user", ".userosscache",
        ".sln.docstates", ".nupkg", ".svg", ".png", ".jpg", ".jpeg", ".gif",
        ".ico", ".pdf", ".mov", ".mp4", ".mp3", ".wav", ".swo", ".swn", ".log",
        ".bak", ".swp", ".tmp", ".temp", ".cache", ".DS_Store", "Thumbs.db",
        "desktop.ini", ".egg-info", ".egg", ".whl", ".so", ".min.js", ".min.css",
        ".map", ".tfstate", ".lock", "poetry.lock", "Pipfile.lock", ".ipynb",
    ]

def default_code_like_extensions() -> List[str]:
    return [
        ".py", ".yml", ".yaml", ".toml", ".json", ".js", ".jsx", ".ts", ".tsx",
        ".java", ".c", ".cpp", ".h", ".hpp", ".go", ".sh", ".bash", ".css",
        ".html", ".xml", ".ini", ".cfg", ".conf", ".dockerfile", ".gitignore",
        ".env", ".sql", ".graphql", ".gql", ".rst", ".md", ".R",
    ]

def parse_content_to_file_list(content: str) -> List[Tuple[str, str]]:
    file_blocks = re.split(r"={8,}\nFile: (.+?)\n={8,}\n", content)
    files = []
    if len(file_blocks) < 2: return []
    for i in range(1, len(file_blocks), 2):
        fname = file_blocks[i].strip()
        fcontent = file_blocks[i+1] if (i+1) < len(file_blocks) else ""
        files.append((fname, fcontent.strip()))
    return files

def format_as_markdown(summary: str, tree: str, file_list: List[Tuple[str, str]]) -> str:
    doc = f"# Analysed directory\n\n{summary}\n\n# Directory structure\n\n```\n{tree.strip()}\n```\n"
    for fname, fcontent in file_list:
        lang = fname.split('.')[-1].lower() if '.' in fname else 'text'
        lang_map = {'js': 'javascript', 'py': 'python', 'sh': 'bash', 'md': 'markdown', 'r': 'r'}
        lang = lang_map.get(lang, lang)
        
        separator = "=" * 60
        doc += f"\n\n{separator}\n## File: `{fname}`\n{separator}\n\n```{lang}\n{fcontent}\n```\n"
    return doc

def format_as_txt(summary: str, tree: str, file_list: List[Tuple[str, str]]) -> str:
    doc = f"=== ANALYSED DIRECTORY ===\n{summary}\n\n=== DIRECTORY STRUCTURE ===\n{tree.strip()}\n\n=== CONTENT ===\n"
    for fname, fcontent in file_list:
        separator = "#" * 80
        doc += f"\n\n{separator}\n# File: {fname}\n{separator}\n\n{fcontent}\n"
    return doc

async def _process_directory(config: CONFIG, inputs: INPUTS, processing_path: str, root_name: str) -> OUTPUT:
    """The unified processing function that works on a local directory."""
    output_basename_input = inputs.output_file or "ingested_directory"
    max_file_size_kb = inputs.max_file_size_kb if inputs.max_file_size_kb is not None else 100

    ignored_directories = set(inputs.ignore_dirs if inputs.ignore_dirs else default_ignored_directories())
    ignored_files_extensions = set(inputs.ignore_extensions if inputs.ignore_extensions else default_ignored_file_extensions())
    code_like_extensions = set(inputs.code_extensions if inputs.code_extensions else default_code_like_extensions())

    max_file_size_bytes = max_file_size_kb * 1024

    def build_tree_structure(dir_path, indent=""):
        tree = ""
        try:
            items = sorted([item for item in os.listdir(dir_path) if item not in ignored_directories])
        except OSError:
            return ""

        for i, item in enumerate(items):
            if any(item.endswith(ext) for ext in ignored_files_extensions): continue
            is_last_item = (i == len(items) - 1)
            connector = "└── " if is_last_item else "├── "
            tree += indent + connector + item
            item_path = os.path.join(dir_path, item)
            if os.path.isdir(item_path):
                tree += "/\n"
                new_indent = indent + ("    " if is_last_item else "│   ")
                tree += build_tree_structure(item_path, new_indent)
            else:
                tree += "\n"
        return tree

    summary = f"Ingested content from: {inputs.directory_path}"
    tree_str = f"{root_name}/\n" + build_tree_structure(processing_path)

    content_str = ""
    for root, dirs, files in os.walk(processing_path, topdown=True):
        dirs[:] = [d for d in dirs if d not in ignored_directories]
        files.sort()
        for file in files:
            if any(file.endswith(ext) for ext in ignored_files_extensions): continue
            if not any(file.endswith(ext) for ext in code_like_extensions): continue

            filepath = os.path.join(root, file)
            relative_filepath = os.path.relpath(filepath, processing_path)
            content = ""
            try:
                if os.path.getsize(filepath) > max_file_size_bytes:
                    content = f"### File size exceeds {max_file_size_kb}KB, skipping content. ###"
                else:
                    with open(filepath, "r", encoding="utf-8") as f: content = f.read()
            except (UnicodeDecodeError, IOError):
                try:
                    with open(filepath, "r", encoding="latin-1") as f: content = f.read()
                except Exception as e: content = f"### ERROR: Could not read file content - {e} ###"
            except Exception as e: content = f"### ERROR: Could not process file - {e} ###"

            content_str += f"================================================\nFile: {relative_filepath.replace(os.sep, '/')}\n================================================\n{content}\n\n"

    file_list = parse_content_to_file_list(content_str)
    fmt = (config.export_format or "md").lower()
    
    if fmt == "txt":
        exported_document = format_as_txt(summary, tree_str, file_list)
    else:
        fmt = "md"
        exported_document = format_as_markdown(summary, tree_str, file_list)

    base_name, _ = os.path.splitext(output_basename_input)
    correct_filename = f"{base_name}.{fmt}"
    
    home_path = await get_home_path()
    file_path = os.path.join(home_path, correct_filename)
    
    with open(file_path, "w", encoding="utf-8") as f: f.write(exported_document)
    
    token_count = "N/A"
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        token_count = len(encoding.encode(exported_document))
    except Exception: token_count = "N/A (tiktoken error)"

    file_size_display = "N/A"
    if os.path.exists(file_path):
        file_size_bytes = os.path.getsize(file_path)
        file_size_kb = file_size_bytes / 1024; file_size_mb = file_size_kb / 1024
        if file_size_mb >= 1: file_size_display = f"{file_size_mb:.2f} MB"
        elif file_size_kb >= 1: file_size_display = f"{file_size_kb:.2f} KB"
        else: file_size_display = f"{file_size_bytes} bytes"

    return OUTPUT(
        ingested_output=exported_document,
        output_path=file_path,
        token_count=token_count,
        file_size_display=file_size_display
    )

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    """Dispatcher: handles local paths and GitHub URLs, then calls the processor."""
    path = inputs.directory_path.strip()

    if path.startswith(('http://', 'https://')):
        # **NEW: Explicitly check for the 'git' command before proceeding.**
        if not shutil.which('git'):
            raise RuntimeError(
                "Git is not installed or not in your system's PATH. "
                "Please install Git to use this feature with GitHub URLs."
            )

        clone_url, repo_name = None, ''
        parsed_url = urlparse(path)
        
        if path.endswith('.git'):
            clone_url = path
            repo_name = os.path.basename(parsed_url.path).replace('.git', '')
        elif 'github.com' in parsed_url.netloc:
            path_parts = parsed_url.path.strip('/').split('/')
            if len(path_parts) >= 2:
                user, repo = path_parts[0], path_parts[1]
                repo_name = repo
                clone_url = f"https://{parsed_url.netloc}/{user}/{repo}.git"

        if not clone_url:
            raise ValueError("Invalid GitHub URL. Please provide a direct link to a repository (e.g., https://github.com/user/repo).")

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                subprocess.run(
                    ['git', 'clone', '--depth', '1', clone_url, temp_dir],
                    check=True, capture_output=True, text=True
                )
            except subprocess.CalledProcessError as e:
                raise RuntimeError(f"Failed to clone repository. Error: {e.stderr}")
            
            return await _process_directory(config, inputs, temp_dir, repo_name)

    elif os.path.isdir(path):
        root_name = os.path.basename(os.path.abspath(path))
        return await _process_directory(config, inputs, path, root_name)
    else:
        raise ValueError("The provided path is not a valid local directory or a recognizable GitHub URL.")