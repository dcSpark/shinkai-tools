import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Arxiv Search Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('searches for basic query successfully', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      query: 'deep learning'
    });
    // the console.log should print multiple levels of the response
    console.log('Full response:', JSON.stringify(response, null, 2));
    console.log('\nPapers array:', JSON.stringify(response.papers, null, 2));
    if (response.papers && response.papers.length > 0) {
      console.log('\nFirst paper details:', JSON.stringify(response.papers[0], null, 2));
    }

    expect(Array.isArray(response.papers)).toBe(true);
    expect(response).toHaveProperty('total_results');
    expect(response.total_results).toBeGreaterThanOrEqual(0);
    if (response.total_results > 0) {
      const paper = response.papers[0];
      expect(paper).toHaveProperty('title');
      expect(paper).toHaveProperty('pdf_url');
    }
  }, 30000);

  it('applies a maximum results limit', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      query: 'blockchain',
      max_results: 3
    });
    expect(Array.isArray(response.papers)).toBe(true);
    expect(response.papers.length).toBeLessThanOrEqual(3);
  }, 30000);

  it('handles date range filters (optional)', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      query: 'quantum computing',
      date_from: '2023-01-01',
      date_to: '2023-12-31',
      max_results: 5
    });
    expect(response.papers.length).toBeLessThanOrEqual(5);
  }, 30000);
}); 