import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Wikimedia Search Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('searches content with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      query: 'artificial intelligence'
    });
    console.log("Response: ", response);

    expect(response).toHaveProperty('results');
    expect(Array.isArray(response.results)).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.length).toBeLessThanOrEqual(10);

    const firstResult = response.results[0];
    expect(firstResult).toHaveProperty('title');
    expect(firstResult).toHaveProperty('description');
    expect(firstResult).toHaveProperty('excerpt');
  }, 30000);

  it('respects limit parameter', async () => {
    const limit = 5;
    const response = await client.executeToolFromFile(toolPath, {
      query: 'artificial intelligence',
      limit
    });

    expect(response.results.length).toBeLessThanOrEqual(limit);
  }, 30000);
});
