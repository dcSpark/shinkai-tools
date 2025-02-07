# /// script
# dependencies = [
#   "requests",
#   "beautifulsoup4",
#   "lxml"
# ]
# ///

import requests
from bs4 import BeautifulSoup
from typing import List, Optional, Dict, Any
import datetime

class CONFIG:
    """
    This class holds the tool's configuration, such as
    default language or advanced flags.
    """
    default_language: str = "en"

class INPUTS:
    """
    This class holds the user-provided inputs.
    """
    url: str
    html: Optional[str] = None
    language: Optional[str] = None

class OUTPUT:
    """
    This class represents the result structure to be returned.
    """
    title: str
    authors: List[str]
    publish_date: str
    summary: str
    keywords: List[str]
    top_image: str
    text: str

def extract_text_content(soup: BeautifulSoup) -> str:
    """Extract main text content from the article."""
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
    
    # Get text
    text = soup.get_text(separator='\n', strip=True)
    return text

def extract_metadata(soup: BeautifulSoup) -> Dict[str, Any]:
    """Extract metadata from meta tags."""
    metadata = {
        "title": "",
        "authors": [],
        "publish_date": "",
        "keywords": [],
        "top_image": ""
    }
    
    # Try to get title
    title_tag = soup.find('title')
    if title_tag:
        metadata["title"] = title_tag.string.strip()
    
    # Try meta tags
    meta_mappings = {
        "author": ["author", "article:author", "og:article:author"],
        "publish_date": ["article:published_time", "publishdate", "date", "published_time"],
        "image": ["og:image", "twitter:image"],
        "keywords": ["keywords", "news_keywords"]
    }
    
    for meta in soup.find_all('meta'):
        name = meta.get('name', '').lower()
        property = meta.get('property', '').lower()
        content = meta.get('content', '')
        
        if not content:
            continue
            
        # Authors
        if name in meta_mappings["author"] or property in meta_mappings["author"]:
            if content not in metadata["authors"]:
                metadata["authors"].append(content)
                
        # Publish date
        elif name in meta_mappings["publish_date"] or property in meta_mappings["publish_date"]:
            metadata["publish_date"] = content
            
        # Image
        elif name in meta_mappings["image"] or property in meta_mappings["image"]:
            if not metadata["top_image"]:
                metadata["top_image"] = content
                
        # Keywords
        elif name in meta_mappings["keywords"] or property in meta_mappings["keywords"]:
            keywords = [k.strip() for k in content.split(',')]
            metadata["keywords"].extend(keywords)
    
    return metadata

async def run(c: CONFIG, p: INPUTS) -> Dict[str, Any]:
    """
    The main run function that processes the article.
    """
    if p.html:
        html_content = p.html
    else:
        # Fetch the URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(p.url, headers=headers)
        response.raise_for_status()
        html_content = response.text

    # Parse HTML
    soup = BeautifulSoup(html_content, 'lxml')
    
    # Extract metadata
    metadata = extract_metadata(soup)
    
    # Extract text content
    text_content = extract_text_content(soup)
    
    # Create summary (first 500 characters of text)
    summary = text_content[:500].strip()
    
    result = {
        "title": metadata["title"],
        "authors": metadata["authors"],
        "publish_date": metadata["publish_date"],
        "summary": summary,
        "keywords": metadata["keywords"],
        "top_image": metadata["top_image"],
        "text": text_content
    }
    
    return result 