import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('iTerm Control Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('sends Ctrl-C command', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      letter: 'C'
    });

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('message');

    expect(typeof response.success).toBe('boolean');
    expect(typeof response.message).toBe('string');

    expect(response.success).toBe(true);
    expect(response.message).toContain('Control-C');
  });

  it('sends Ctrl-D command', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      letter: 'D'
    });

    expect(response.success).toBe(true);
    expect(response.message).toContain('Control-D');
  });

  it('handles invalid control character', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      letter: 'X'
    });

    expect(response.success).toBe(false);
    expect(response.message).toContain('not supported');
  });

  it('handles empty input', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      letter: ''
    });

    expect(response.success).toBe(false);
    expect(response.message).toContain('must provide a single letter');
  });

  it('handles lowercase input', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      letter: 'c'
    });

    expect(response.success).toBe(true);
    expect(response.message).toContain('Control-C');
  });
}); 