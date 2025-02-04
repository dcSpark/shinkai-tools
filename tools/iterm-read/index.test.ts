import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('iTerm Read Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('reads terminal output with default line count', async () => {
    const response = await client.executeToolFromFile(toolPath, {});
    console.log("Response: ", response);

    expect(response).toHaveProperty('terminal_output');
    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('message');

    expect(typeof response.terminal_output).toBe('string');
    expect(typeof response.success).toBe('boolean');
    expect(typeof response.message).toBe('string');

    expect(response.success).toBe(true);
  });

  it('reads specific number of lines', async () => {
    const lines = 10;
    const response = await client.executeToolFromFile(toolPath, {
      lines_of_output: lines
    });

    expect(response.success).toBe(true);
    expect(response.terminal_output.split('\n').length).toBeLessThanOrEqual(lines);
  });

  it('handles zero lines request', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      lines_of_output: 0
    });

    expect(response.success).toBe(true);
    expect(response.terminal_output).toBe('');
  });

  it('handles large line count request', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      lines_of_output: 1000
    });

    expect(response.success).toBe(true);
    expect(response.terminal_output.length).toBeGreaterThan(0);
  });
}); 