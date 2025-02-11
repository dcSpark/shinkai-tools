import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Article Scraper Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('scrapes an article from a URL', async () => {
    const result = await client.executeToolFromFile(toolPath, {
      url: 'http://fox13now.com/2013/12/30/new-year-new-laws-obamacare-pot-guns-and-drones/'
    });
    
    // Basic checks
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('authors');
    expect(result).toHaveProperty('publish_date');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('top_image');
    expect(result).toHaveProperty('text');

    // Check types
    expect(Array.isArray(result.authors)).toBe(true);
    expect(Array.isArray(result.keywords)).toBe(true);
    expect(typeof result.text).toBe('string');
    expect(result.text).toContain('Obamacare');
    expect(result.text).toContain('New Year');
  }, 30000);

  it('scrapes article from raw HTML instead of URL', async () => {
    const fakeHtml = `
      <html>
        <head>
          <title>Test Title from HTML</title>
          <meta name="author" content="John Doe">
          <meta name="keywords" content="test, article">
        </head>
        <body>
          <div class="byline">By John Doe</div>
          <p>This is some test content for an HTML-based article extraction.</p>
        </body>
      </html>
    `;
    const result = await client.executeToolFromFile(toolPath, {
      url: 'http://example.com/',
      html: fakeHtml,
      language: 'en'
    });

    expect(result.title).toBe('Test Title from HTML');
    expect(result.authors).toContain('John Doe');
    expect(result.keywords).toContain('test');
    expect(result.keywords).toContain('article');
    expect(typeof result.text).toBe('string');
    expect(result.text).toContain('test content');
  });
}); 