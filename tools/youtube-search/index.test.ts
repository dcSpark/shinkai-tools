import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('YouTube Search Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();
  const TEST_API_KEY = 'test_key';

  it('performs a basic search with default settings', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      search_query: "Deno tutorial",
      hl: "en",
      gl: "us",
      max_results: 3
    }, {
      SERP_API_KEY: TEST_API_KEY
    });

    expect(Array.isArray(response.results)).toBe(true);
    expect(response.query).toBe("Deno tutorial");
    
    if (response.results.length > 0) {
      const result = response.results[0];
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('link');
      expect(result).toHaveProperty('channel');
      expect(result).toHaveProperty('views');
      expect(result).toHaveProperty('duration');
      
      expect(typeof result.title).toBe('string');
      expect(typeof result.link).toBe('string');
      expect(typeof result.channel).toBe('string');
    }
  }, 30000);

  it('handles invalid query gracefully', async () => {
    await expect(
      client.executeToolFromFile(toolPath, { search_query: "" }, { SERP_API_KEY: TEST_API_KEY })
    ).rejects.toThrow(/No search query provided/i);
  });

  it('handles missing API key gracefully', async () => {
    await expect(
      client.executeToolFromFile(toolPath, { search_query: "test" }, {})
    ).rejects.toThrow(/SERP_API_KEY not provided in config/i);
  });
});
