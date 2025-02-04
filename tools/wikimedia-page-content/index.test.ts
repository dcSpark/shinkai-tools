import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Wikimedia Page Content Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('fetches page content with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      title: 'Artificial intelligence'
    });
    console.log("Response: ", response);
    expect(response).toHaveProperty('content');
    expect(response.content).toHaveProperty('title');
    expect(response.content).toHaveProperty('html');
    expect(response.content).toHaveProperty('url');
    expect(response.content).toHaveProperty('lastModified');
    expect(response.content).toHaveProperty('language');

    expect(response.content.title).toBe('Artificial intelligence');
    expect(response.content.html).toBeTruthy();
    expect(response.content.url).toBe('https://en.wikipedia.org/wiki/Artificial_intelligence');
    expect(response.content.language).toBe('en');
  }, 30000);

  it('handles custom project and language', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      title: 'Intelligence artificielle'
    }, {
      project: 'wikipedia',
      language: 'fr'
    });

    expect(response.content.url).toBe('https://fr.wikipedia.org/wiki/Intelligence_artificielle');
    expect(response.content.language).toBe('fr');
    expect(response.content.html).toBeTruthy();
  }, 30000);

  it('handles titles with spaces', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      title: 'Machine learning'
    });

    expect(response.content.url).toBe('https://en.wikipedia.org/wiki/Machine_learning');
    expect(response.content.title).toBe('Machine learning');
    expect(response.content.html).toBeTruthy();
  }, 30000);
});
