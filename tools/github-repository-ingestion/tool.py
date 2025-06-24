# /// script
# dependencies = [
#   "requests",
#   "gitingest",
# ]
# ///

from typing import Any, Optional, Set, List # Added Set, List for type hinting
import os
from shinkai_local_support import get_home_path
from gitingest import ingest_async # Explicitly importing ingest_async

class CONFIG:
    export_format: Optional[str] = "md"  # 'md', 'xml', 'txt', or 'none'

class INPUTS:
    repo_url: str  # Path or URL to the repo to ingest
    max_size_mb: Optional[float] = None  # Only include files <= this size in MB
    include_patterns: Optional[str] = None  # Comma-separated patterns to include files (e.g., "*.py, *.js")
    exclude_patterns: Optional[str] = None  # Comma-separated patterns to exclude files (e.g., "*.log, *.json")

class OUTPUT:
    summary: Any
    tree: Any
    content: Any
    exported_document_path: str

def parse_content_to_file_list(content: str):
    import re
    file_blocks = re.split(r"={8,}\nFile: (.+?)\n={8,}\n", content)
    files = []
    if len(file_blocks) < 2:
        return []
    for i in range(1, len(file_blocks), 2):
        fname = file_blocks[i].strip()
        fcontent = file_blocks[i+1] if (i+1) < len(file_blocks) else ""
        files.append((fname, fcontent.strip()))
    return files

def format_as_markdown(summary: str, tree: str, file_list) -> str:
    doc = f"# Summary\n\n{summary}\n\n# Tree\n\n```\n{tree.strip()}\n```\n"
    for fname, fcontent in file_list:
        doc += f"\n## File: {fname}\n\n```text\n{fcontent}\n```\n"
    return doc

def format_as_xml(summary: str, tree: str, file_list) -> str:
    from xml.sax.saxutils import escape
    doc = f"<repository>\n  <summary>{escape(summary)}</summary>\n  <tree>{escape(tree)}</tree>\n  <files>\n"
    for fname, fcontent in file_list:
        doc += f"    <file name=\"{escape(fname)}\"><![CDATA[\n{fcontent}\n]]></file>\n"
    doc += "  </files>\n</repository>\n"
    return doc

def format_as_txt(summary: str, tree: str, file_list) -> str:
    doc = f"=== SUMMARY ===\n{summary}\n\n=== TREE ===\n{tree.strip()}\n\n=== CONTENT ===\n"
    for fname, fcontent in file_list:
        doc += f"\n--- {fname} ---\n{fcontent}\n"
    return doc

def get_repo_name(repo_url: str) -> str:
    import re
    if repo_url.endswith("/"):
        repo_url = repo_url[:-1]
    name = repo_url.split("/")[-1]
    name = name.split(".")[0] if "." in name else name
    if not name:
        name = "repo_export"
    return re.sub(r"[^A-Za-z0-9_\-]", "_", name)

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    max_size = int(inputs.max_size_mb * 1024 * 1024) if inputs.max_size_mb is not None else None
    
    # Helper function to parse comma-separated patterns
    def parse_comma_separated_patterns(patterns_str: Optional[str]) -> Set[str]:
        if not patterns_str: # Handles None or empty string
            return set()
        # Split by comma, then strip whitespace from each part, then filter out empty strings
        # that might result from ",," or trailing/leading commas.
        return {pattern.strip() for pattern in patterns_str.split(',') if pattern.strip()}

    processed_include_patterns: Set[str] = parse_comma_separated_patterns(inputs.include_patterns)
    processed_exclude_patterns: Set[str] = parse_comma_separated_patterns(inputs.exclude_patterns)

    summary, tree, content = await ingest_async(
        inputs.repo_url,
        max_size,
        processed_include_patterns, # Pass Set[str]
        processed_exclude_patterns, # Pass Set[str]
        output=None
    )
    
    fmt = (config.export_format or "md").lower()
    exported_document_path = ""
    file_list = parse_content_to_file_list(content)
    
    if fmt != "none":
        exported_document: str
        ext: str
        if fmt == "xml":
            exported_document = format_as_xml(summary, tree, file_list)
            ext = "xml"
        elif fmt == "txt":
            exported_document = format_as_txt(summary, tree, file_list)
            ext = "txt"
        else:
            exported_document = format_as_markdown(summary, tree, file_list)
            ext = "md"
        
        home_path = await get_home_path()
        repo_name = get_repo_name(inputs.repo_url)
        filename = f"{repo_name}_ingest_export.{ext}"
        file_path = os.path.join(home_path, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(exported_document)
        exported_document_path = file_path
        
    output = OUTPUT()
    output.summary = summary
    output.tree = tree
    output.content = content
    output.exported_document_path = exported_document_path
    
    return output