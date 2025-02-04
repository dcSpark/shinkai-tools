import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Wikimedia Title Search Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('searches titles with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      query: 'artificial intelligence'
    });
    console.log("Response: ", response);

    expect(response).toHaveProperty('titles');
    expect(Array.isArray(response.titles)).toBe(true);
    expect(response.titles.length).toBeGreaterThan(0);
    expect(response.titles.length).toBeLessThanOrEqual(10);

    const firstResult = response.titles[0];
    expect(firstResult).toHaveProperty('title');
    expect(firstResult).toHaveProperty('description');
    expect(firstResult).toHaveProperty('url');
    expect(firstResult.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
  }, 30000);

  it('respects limit parameter', async () => {
    const limit = 5;
    const response = await client.executeToolFromFile(toolPath, {
      query: 'artificial intelligence',
      limit
    });

    expect(response.titles.length).toBeLessThanOrEqual(limit);
  }, 30000);

  it('handles custom project and language', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      query: 'intelligence artificielle'
    }, {
      project: 'wikipedia',
      language: 'fr'
    });

    expect(response.titles[0].url).toMatch(/^https:\/\/fr\.wikipedia\.org\/wiki\//);
  }, 30000);
});
