import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('macos-finder Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('gets selected files', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'getSelectedFiles'
    });
    expect(response).toHaveProperty('result');
    // Could be "No items selected" or a list of paths
    expect(typeof response.result).toBe('string');
  });

  it('searches for files in home directory', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'searchFiles',
      query: '2024',
      location: '~'
    });
    console.log("Response: ", response);
    expect(response).toHaveProperty('result');
    expect(typeof response.result).toBe('string');
  });

  it('searches for files with default location', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'searchFiles',
      query: '2024-12-29'
    });
    console.log("Response: ", response);
    expect(response).toHaveProperty('result');
    expect(typeof response.result).toBe('string');
  });

  it('opens quick look for a file', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'quickLookFile',
      file_path: '~/Desktop/Screenshot 2025-02-01 at 12.01.02 AM.png'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Quick Look preview opened for');
  });

  it('fails with invalid command', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'invalidCommand'
    })).rejects.toThrow();
  });

  it('fails searching without query', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'searchFiles'
    })).rejects.toThrow('Missing "query" for searchFiles');
  });

  it('fails quick look without file path', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'quickLookFile'
    })).rejects.toThrow('Missing "file_path" for quickLookFile');
  });
}); 