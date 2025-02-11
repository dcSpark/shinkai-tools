import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Google News Search Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();
  const TEST_API_KEY = '';

  it('fetches news articles for a basic query', async () => {
    // Provide a query, plus any other desired configs or parameters
    const response = await client.executeToolFromFile(toolPath, {
      query: 'OpenAI and ChatGPT',
      hl: 'en',
      gl: 'us',
      num_results: 3
    }, {
      SERP_API_KEY: TEST_API_KEY
    });

    console.log(response);

    expect(response).toHaveProperty('results');
    expect(response).toHaveProperty('query');
    expect(response.results.length).toBeGreaterThan(0);

    // check some fields
    const firstResult = response.results[0];
    expect(firstResult).toHaveProperty('title');
    expect(firstResult).toHaveProperty('link');
    expect(firstResult).toHaveProperty('source');
  }, 30000);

  it('handles invalid or empty query gracefully', async () => {
    // Expect an error if query is empty
    await expect(
      client.executeToolFromFile(toolPath, { query: '' }, { SERP_API_KEY: TEST_API_KEY })
    ).rejects.toThrow(/No search query provided/i);
  }, 15000);

  it('handles missing SERP_API_KEY gracefully', async () => {
    await expect(
      client.executeToolFromFile(toolPath, {
        query: 'test'
      }, {})
    ).rejects.toThrow(/SERP_API_KEY not provided in config/i);
  }, 15000);
}); 