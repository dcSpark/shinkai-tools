import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('iTerm Write Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('writes a simple command to iTerm', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'echo "Hello from iTerm write test"'
    });

    expect(response).toHaveProperty('lines_output');
    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('message');

    expect(typeof response.lines_output).toBe('number');
    expect(typeof response.success).toBe('boolean');
    expect(typeof response.message).toBe('string');

    expect(response.success).toBe(true);
    expect(response.lines_output).toBeGreaterThan(0);
  });

  it('handles multiline commands', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'echo "Line 1"\necho "Line 2"'
    });

    expect(response.success).toBe(true);
    expect(response.lines_output).toBe(2);
  });

  it('handles empty command input', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: ''
    });

    expect(response.success).toBe(false);
    expect(response.message).toContain('No command specified');
  });

  it('handles special characters in command', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'echo "Special chars: !@#$%^&*()"'
    });

    expect(response.success).toBe(true);
    expect(response.lines_output).toBeGreaterThan(0);
  });
}); 