import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

interface Article {
  title: string;
  url: string;
  source: string;
  summary: string;
  publish_date: string;
  authors: string[];
  top_image: string;
  text: string;
}

interface NewsAggregatorResult {
  total_sources_processed: number;
  total_articles_found: number;
  failed_sources: string[];
  articles: Article[];
  processing_time: number;
}

describe('News Aggregator Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('aggregates news from specific providers', async () => {
    const result = await client.executeToolFromFile(toolPath, {
      providers: ['https://reuters.com', 'https://techcrunch.com'],
      articles_per_source: 3
    }) as NewsAggregatorResult;
    console.log(result);
    
    // Basic checks
    expect(result).toHaveProperty('total_sources_processed');
    expect(result).toHaveProperty('total_articles_found');
    expect(result).toHaveProperty('failed_sources');
    expect(result).toHaveProperty('articles');
    expect(result).toHaveProperty('processing_time');

    // Type checks
    expect(Array.isArray(result.articles)).toBe(true);
    expect(Array.isArray(result.failed_sources)).toBe(true);
    expect(typeof result.total_sources_processed).toBe('number');
    expect(typeof result.total_articles_found).toBe('number');
    expect(typeof result.processing_time).toBe('number');

    // Content checks
    if (result.articles.length > 0) {
      const article = result.articles[0];
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('url');
      expect(article).toHaveProperty('source');
      expect(article).toHaveProperty('summary');
      expect(article).toHaveProperty('publish_date');
      expect(article).toHaveProperty('authors');
      expect(article).toHaveProperty('top_image');
      expect(article).toHaveProperty('text');
    }
  }, 60000);

  it('aggregates news by categories', async () => {
    const result = await client.executeToolFromFile(toolPath, {
      providers: [],
      categories: ['tech'],
      articles_per_source: 2
    }) as NewsAggregatorResult;
    
    expect(result.total_sources_processed).toBeGreaterThan(0);
    expect(result.articles.length).toBeGreaterThan(0);
    
    // Verify sources are from tech category
    const techDomains = ['techcrunch.com', 'theverge.com', 'wired.com'];
    const hasTechSource = result.articles.some((article: Article) => 
      techDomains.some(domain => article.source.includes(domain))
    );
    expect(hasTechSource).toBe(true);
  }, 60000);

  it('handles failed sources gracefully', async () => {
    const result = await client.executeToolFromFile(toolPath, {
      providers: ['http://invalid-news-source.com'],
      articles_per_source: 1
    }) as NewsAggregatorResult;
    
    expect(result.failed_sources).toContain('http://invalid-news-source.com');
    expect(result.total_sources_processed).toBe(0);
    expect(result.articles.length).toBe(0);
  }, 30000);
}); 