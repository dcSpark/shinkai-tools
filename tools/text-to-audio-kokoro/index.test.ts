import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Text to Audio Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();
  const testText = 'Hello, this is a test message.';

  it('converts text to audio with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      text: testText
    }, {});

    console.log("Response: ", response);

    expect(response).toHaveProperty('output_file');
    expect(response).toHaveProperty('duration');
    expect(response).toHaveProperty('sample_rate');
    expect(response).toHaveProperty('chars_per_second');

    expect(typeof response.output_file).toBe('string');
    expect(typeof response.duration).toBe('number');
    expect(typeof response.sample_rate).toBe('number');
    expect(typeof response.chars_per_second).toBe('number');

    expect(response.duration).toBeGreaterThan(0);
    expect(response.sample_rate).toBeGreaterThan(0);
    expect(response.chars_per_second).toBeGreaterThan(0);
  }, 30000);

  it('converts text to audio with custom parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      text: testText,
      voice: 'af_sky',
      language: 'en-gb',
      speed: 1.5,
      output_format: 'wav'
    }, {});

    expect(response.output_file).toMatch(/\.wav$/);
    expect(response.duration).toBeGreaterThan(0);
    expect(response.sample_rate).toBeGreaterThan(0);
    expect(response.chars_per_second).toBeGreaterThan(0);
  }, 30000);

  it('handles empty text input', async () => {
    await expect(
      client.executeToolFromFile(toolPath, {
        text: ''
      }, {})
    ).rejects.toThrow('Text input cannot be empty');
  });

  it('handles very long text input', async () => {
    const longText = 'Hello '.repeat(1000);
    const response = await client.executeToolFromFile(toolPath, {
      text: longText
    }, {});

    expect(response.duration).toBeGreaterThan(0);
    expect(response.chars_per_second).toBeGreaterThan(0);
  }, 60000);
}); 