import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Wikimedia Featured Content Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('fetches featured content with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, {});

    console.log("Response: ", response);

    expect(response).toHaveProperty('featured');
    expect(response.featured).toHaveProperty('tfa');
    expect(response.featured).toHaveProperty('image');
    expect(response.featured).toHaveProperty('news');

    expect(response.featured.tfa).toHaveProperty('title');
    expect(response.featured.tfa).toHaveProperty('extract');
    expect(response.featured.tfa).toHaveProperty('url');
    expect(response.featured.tfa.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);

    expect(response.featured.image).toHaveProperty('title');
    expect(response.featured.image).toHaveProperty('description');
    expect(response.featured.image).toHaveProperty('url');

    expect(Array.isArray(response.featured.news)).toBe(true);
    if (response.featured.news.length > 0) {
      const firstNews = response.featured.news[0];
      expect(firstNews).toHaveProperty('story');
      expect(firstNews).toHaveProperty('links');
      expect(Array.isArray(firstNews.links)).toBe(true);
    }
  }, 30000);

  it('handles custom date parameter', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      date: '2024-01-01'
    });

    expect(response.featured.tfa).toBeTruthy();
    expect(response.featured.image).toBeTruthy();
    expect(Array.isArray(response.featured.news)).toBe(true);
  }, 30000);

  it('handles custom language and project', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, {
      project: 'wikipedia',
      language: 'fr'
    });

    expect(response.featured.tfa.url).toMatch(/^https:\/\/fr\.wikipedia\.org\/wiki\//);
  }, 30000);
});
