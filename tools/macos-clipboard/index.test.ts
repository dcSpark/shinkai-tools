import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('macos-clipboard Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('sets and gets clipboard text', async () => {
    const testText = 'Test clipboard text ' + Date.now();
    
    // Set clipboard
    const setResponse = await client.executeToolFromFile(toolPath, {
      command: 'setClipboard',
      content: testText
    });
    expect(setResponse).toHaveProperty('result');
    expect(setResponse.result).toBe('Clipboard set successfully');

    // Get clipboard
    const getResponse = await client.executeToolFromFile(toolPath, {
      command: 'getClipboard',
      content_type: 'text'
    });
    expect(getResponse).toHaveProperty('result');
    expect(getResponse.result).toBe(testText);
  });

  it('clears clipboard', async () => {
    // First set some content
    await client.executeToolFromFile(toolPath, {
      command: 'setClipboard',
      content: 'Content to clear'
    });

    // Then clear it
    const clearResponse = await client.executeToolFromFile(toolPath, {
      command: 'clearClipboard'
    });
    expect(clearResponse).toHaveProperty('result');
    expect(clearResponse.result).toBe('Clipboard cleared');

    // Verify it's cleared
    const getResponse = await client.executeToolFromFile(toolPath, {
      command: 'getClipboard'
    });
    expect(getResponse).toHaveProperty('result');
    expect(getResponse.result).toBe('');
  });

  it('gets clipboard as file paths when empty', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'getClipboard',
      content_type: 'filePaths'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toBe('No file paths in clipboard');
  });

  it('fails with invalid command', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'invalidCommand'
    })).rejects.toThrow();
  });

  it('fails setting clipboard without content', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'setClipboard'
    })).rejects.toThrow('Missing "content" for setClipboard');
  });
}); 