# /// script
# requires-python = "==3.10"
# dependencies = [
#   "requests==2.31.0",
#   "newspaper3k==0.2.8",
#   "aiohttp==3.9.1",
#   "lxml==5.1.0",
#   "beautifulsoup4==4.12.2",
#   "nltk==3.8.1",
#   "feedparser==6.0.10",
#   "tldextract==5.1.1",
#   "feedfinder2==0.0.4",
#   "python-dateutil==2.8.2",
#   "cssselect==1.2.0"
# ]
# ///

import newspaper
from newspaper import Article
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple
import asyncio
import aiohttp
import time
import feedparser
from datetime import datetime
import logging
import traceback
import nltk
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    logger.info("Downloading required NLTK data...")
    nltk.download('punkt', quiet=True)

# RSS feed URLs for major news sites - using more reliable feeds
RSS_FEEDS = {
    "reuters": "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
    "techcrunch": "https://techcrunch.com/feed",
    "theverge": "https://www.theverge.com/rss/index.xml",
    "wired": "https://www.wired.com/feed/rss",
    "bloomberg": "https://www.bloomberg.com/feeds/sitemap_news.xml"
}

# Default news providers by category if none specified
DEFAULT_PROVIDERS = {
    "general": [
        "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",  # Use RSS feed URL directly
        "https://www.apnews.com",
        "https://www.bbc.com",
    ],
    "tech": [
        "https://techcrunch.com",
        "https://www.theverge.com",
        "https://www.wired.com",
    ],
    "business": [
        "https://www.bloomberg.com",
        "https://www.cnbc.com",
        "https://www.forbes.com",
    ]
}

@dataclass
class AggregatedArticle:
    title: str
    url: str
    source: str
    summary: str
    publish_date: str
    authors: List[str]
    top_image: str
    text: str

class CONFIG:
    """Configuration for the multi-source news aggregator"""
    language: str = "en"
    number_threads: int = 10
    request_timeout: int = 30
    max_concurrent_sources: int = 5
    
class INPUTS:
    """Input parameters for news aggregation"""
    providers: List[str]  # List of news provider URLs
    articles_per_source: Optional[int] = 5
    categories: Optional[List[str]] = None  # If not provided, use all categories
    
class OUTPUT:
    """Output structure containing aggregated news"""
    total_sources_processed: int
    total_articles_found: int
    failed_sources: List[str]
    articles: List[Dict[str, Any]]
    processing_time: float

def format_date(date: datetime) -> str:
    """Format datetime object to ISO string or return empty string if None"""
    if date:
        return date.isoformat()
    return ""

async def process_article(article: Article, source_url: str) -> Optional[AggregatedArticle]:
    """Process a single article with fallback for NLP failures"""
    try:
        article.download()
        article.parse()
        
        # Try NLP but don't fail if it errors
        try:
            article.nlp()
        except Exception as e:
            logger.warning(f"NLP processing failed for {article.url}: {str(e)}")
            # Create a basic summary from the first few sentences if NLP fails
            text = article.text or ""
            summary = ". ".join(text.split(". ")[:3]) if text else ""
        
        return AggregatedArticle(
            title=article.title or "",
            url=article.url,
            source=source_url,
            summary=getattr(article, 'summary', "") or "",
            publish_date=format_date(article.publish_date) if article.publish_date else "",
            authors=article.authors or [],
            top_image=article.top_image or "",
            text=article.text or ""
        )
    except Exception as e:
        logger.warning(f"Failed to process article {article.url}: {str(e)}")
        return None

async def try_rss_feed(source_url: str, max_articles: int) -> List[AggregatedArticle]:
    """Try to fetch articles using RSS feed if available"""
    try:
        # Extract domain from URL
        domain = source_url.split('www.')[-1].split('.com')[0] if 'www.' in source_url else source_url.split('.com')[0].split('//')[-1]
        
        if domain in RSS_FEEDS:
            feed = feedparser.parse(RSS_FEEDS[domain])
            articles = []
            
            for entry in feed.entries[:max_articles]:
                try:
                    # Create article object from feed entry
                    article = Article(entry.link)
                    processed = await process_article(article, source_url)
                    if processed:
                        articles.append(processed)
                except Exception as e:
                    logger.warning(f"Error processing RSS entry {entry.link}: {str(e)}")
                    continue
                    
            return articles
    except Exception as e:
        logger.warning(f"Error fetching RSS feed for {source_url}: {str(e)}")
    return []

async def process_source(source_url: str, max_articles: int, config: CONFIG) -> tuple[str, List[AggregatedArticle]]:
    """Process a single news source and return its articles"""
    try:
        # Configure newspaper for this source
        newspaper.Config.language = config.language
        newspaper.Config.number_threads = config.number_threads
        newspaper.Config.request_timeout = 15  # Shorter timeout
        newspaper.Config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        newspaper.Config.fetch_images = False
        newspaper.Config.memoize_articles = False
        
        # Additional headers for better access
        newspaper.Config.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        }
        
        # Special handling for Reuters - always use RSS feed
        if "reuters.com" in source_url:
            source_url = RSS_FEEDS["reuters"]
            
        # Ensure URL uses HTTPS
        if not source_url.startswith('https://'):
            source_url = source_url.replace('http://', 'https://')
            if not source_url.startswith('https://'):
                source_url = 'https://' + source_url

        # Add www if not present and not an RSS feed
        if not source_url.startswith('https://www.') and 'feed' not in source_url:
            source_url = source_url.replace('https://', 'https://www.')
        
        # First try RSS feed
        articles = await try_rss_feed(source_url, max_articles)
        if articles:
            logger.info(f"Successfully fetched {len(articles)} articles via RSS from {source_url}")
            return source_url, articles
            
        # If RSS fails, try direct scraping
        logger.info(f"Attempting direct scraping for {source_url}")
        
        # Build paper
        paper = newspaper.build(source_url, 
                              language=config.language,
                              memoize_articles=False)
        
        articles = []
        for i, article in enumerate(paper.articles):
            if i >= max_articles:
                break
                
            processed = await process_article(article, source_url)
            if processed:
                articles.append(processed)
                logger.info(f"Successfully processed article: {article.url}")
                
        if articles:
            logger.info(f"Successfully fetched {len(articles)} articles via scraping from {source_url}")
        else:
            logger.warning(f"No articles found for {source_url}")
            
        return source_url, articles
    except Exception as e:
        logger.error(f"Failed to process {source_url}: {str(e)}\n{traceback.format_exc()}")
        return source_url, []

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    """
    Aggregate latest news from multiple sources in parallel.
    """
    start_time = time.time()
    output = OUTPUT()
    output.failed_sources = []
    output.articles = []
    
    # Use default providers if none specified
    providers = inputs.providers
    if not providers:
        if inputs.categories:
            providers = []
            for category in inputs.categories:
                if category.lower() in DEFAULT_PROVIDERS:
                    providers.extend(DEFAULT_PROVIDERS[category.lower()])
        else:
            # Use all default providers if no categories specified
            providers = [url for urls in DEFAULT_PROVIDERS.values() for url in urls]
    
    # Process sources in parallel with rate limiting
    semaphore = asyncio.Semaphore(config.max_concurrent_sources)
    async with semaphore:
        tasks = []
        for source_url in providers:
            task = asyncio.create_task(
                process_source(
                    source_url,
                    inputs.articles_per_source,
                    config
                )
            )
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
    
    # Process results
    successful_sources = 0
    total_articles = 0
    
    for source_url, articles in results:
        if articles:
            successful_sources += 1
            total_articles += len(articles)
            
            # Convert articles to dictionary format
            for article in articles:
                output.articles.append({
                    "title": article.title,
                    "url": article.url,
                    "source": article.source,
                    "summary": article.summary,
                    "publish_date": article.publish_date,
                    "authors": article.authors,
                    "top_image": article.top_image,
                    "text": article.text
                })
        else:
            output.failed_sources.append(source_url)
    
    # Sort articles by publish date (most recent first)
    output.articles.sort(
        key=lambda x: x["publish_date"] if x["publish_date"] else "0",
        reverse=True
    )
    
    output.total_sources_processed = successful_sources
    output.total_articles_found = total_articles
    output.processing_time = time.time() - start_time
    
    return output 