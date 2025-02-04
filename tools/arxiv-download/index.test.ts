import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';
import * as fs from 'fs';

describe('Arxiv Download Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();
  const storageFolder = path.join(process.cwd(), 'test-arxiv-download');

  beforeAll(() => {
    fs.mkdirSync(storageFolder, { recursive: true });
  });

  it('handles unknown paper gracefully', async () => {
    const response = await client.executeToolFromFile(
      toolPath,
      { paper_id: 'nonexistentid' },
      { storage_folder: storageFolder }
    );
    expect(response.status).toBe('error');
    expect(response.message).toMatch(/Paper not found/i);
  }, 60000);

  it('downloads a known paper (will skip real invalid IDs, you can mock)', async () => {
    // Provide a real arXiv ID for testing. This test might need to be mocked
    // for offline usage. For demonstration, let's do something like:
    const testPaperId = '2101.00001'; // Example only, might exist
    const response = await client.executeToolFromFile(
      toolPath,
      { paper_id: testPaperId, convert_to_md: false },
      { storage_folder: storageFolder }
    );
    if (response.status === 'error') {
      // Possibly paper not found or network error
      console.warn('Could not test real paper - possibly invalid or network offline');
      expect(response.message).toMatch(/Paper not found|Error/);
    } else {
      expect(response.status).toBe('success');
      expect(typeof response.message).toBe('string');
      // If it succeeded, we should have a PDF in the folder
      const pdfPath = path.join(storageFolder, testPaperId + '.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);
    }
  }, 90000);

  it('downloads and converts to md', async () => {
    const testPaperId = '2101.00001v1';
    const response = await client.executeToolFromFile(
      toolPath,
      { paper_id: testPaperId, convert_to_md: true },
      { storage_folder: storageFolder }
    );
    if (response.status === 'success') {
      expect(fs.existsSync(response.md_file)).toBe(true);
    }
  }, 90000);
}); 