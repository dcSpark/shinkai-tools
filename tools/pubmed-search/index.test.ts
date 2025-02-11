import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

/**
 * This test file ensures the PubMed Search tool can:
 * 1. Successfully fetch a small number of results
 * 2. Handle "no results" scenarios gracefully
 * 3. Cope with invalid queries or missing environment config
 */

describe('PubMed Search Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();
  const TEST_EMAIL = 'integrations@shinkai.com';

  it('fetches search results for a known query', async () => {
    console.log('Using email:', TEST_EMAIL);
    const response = await client.executeToolFromFile(toolPath, {
      query: 'cancer immunotherapy',
      max_results: 3
    }, {
      entrez_email: TEST_EMAIL
    });
    console.log('Response:', JSON.stringify(response, null, 2));

    // We expect a successful status
    expect(response.status).toBe('success');
    expect(response.query).toBe('cancer immunotherapy');
    expect(response.total_results).toBeGreaterThan(0);
    // The 'records' field should contain some MEDLINE text
    expect(typeof response.records).toBe('string');
    expect(response.records.length).toBeGreaterThan(0);

    // We show only up to 3 records
    expect(response.showing).toBeLessThanOrEqual(3);
  }, 30000);

  it('handles no results scenario gracefully', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      query: 'zzzzzzzzzzthiswontmatchanything',
      max_results: 5
    }, {
      entrez_email: TEST_EMAIL
    });

    expect(response.status).toBe('no_results');
    expect(response.total_results).toBe(0);
    expect(response.showing).toBe(0);
  }, 30000);

  it('throws an error if no email is provided', async () => {
    await expect(
      client.executeToolFromFile(toolPath, { query: 'heart disease' }, {})
    ).rejects.toThrow(/No Entrez email provided/i);
  }, 30000);
}); 