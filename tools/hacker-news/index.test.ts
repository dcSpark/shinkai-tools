import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Hacker News Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('fetches top stories from Hacker News with default limit', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, {});

    const stories = response.stories;
    expect(Array.isArray(stories)).toBe(true);
    expect(stories.length).toBe(10); // Default limit is 10
    
    // Check first story has required properties
    if (stories.length > 0) {
      const story = stories[0];
      expect(story).toHaveProperty('title');
      expect(story).toHaveProperty('author');
      expect(story).toHaveProperty('url');
      
      // Check property types and values
      expect(typeof story.title).toBe('string');
      expect(story.title.length).toBeGreaterThan(0);
      expect(typeof story.author).toBe('string');
      expect(story.author.length).toBeGreaterThan(0);
      expect(typeof story.url).toBe('string');
      expect(story.url).toMatch(/^https?:\/\//);
    }
  }, 10000);

  it('respects custom limit', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, { limit: 3 });
    console.log(response);
    expect(Array.isArray(response.stories)).toBe(true);
    expect(response.stories.length).toBe(3);
  });

  it('handles invalid limits gracefully', async () => {
    // Test with negative limit
    const responseNegative = await client.executeToolFromFile(toolPath, {}, { limit: -1 });
    expect(responseNegative.stories.length).toBe(1); // Should use minimum limit of 1

    // Test with limit > 10
    const responseOverLimit = await client.executeToolFromFile(toolPath, {}, { limit: 20 });
    expect(responseOverLimit.stories.length).toBe(10); // Should cap at maximum of 10
  });
}); 