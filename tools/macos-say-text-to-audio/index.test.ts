import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('macOS Text-to-Speech', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('speaks text with default voice and rate', async () => {
    const response = await client.executeToolFromFile(
      toolPath,
      { text: "Hello from text to speech test" },
      {},
      []
    );

    expect(response).toHaveProperty('success', true);
    expect(response.message).toMatch(/Spoke text with voice=Alex/);
  }, 15000);

  it('handles empty text gracefully', async () => {
    await expect(
      client.executeToolFromFile(toolPath, { text: '' }, {}, [])
    ).rejects.toThrow(/No text provided/);
  });

  it('respects custom voice and rate', async () => {
    const response = await client.executeToolFromFile(
      toolPath,
      {
        text: "Testing custom voice and rate",
        voice: "Daniel",
        rate: 200
      },
      {},
      []
    );
    expect(response.success).toBe(true);
    expect(response.message).toMatch(/voice=Daniel/);
    expect(response.message).toMatch(/rate=200/);
  }, 15000);
}); 