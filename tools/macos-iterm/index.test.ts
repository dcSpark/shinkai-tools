import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('macos-iterm Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('pastes clipboard to iTerm', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'pasteClipboard'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toBe('Pasted clipboard to iTerm');
  });

  it('runs command in current window', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'runCommand',
      cmd: 'echo "Hello from test"',
      new_window: false
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Ran \'echo "Hello from test"\' in existing iTerm window');
  });

  it('runs command in new window', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'runCommand',
      cmd: 'echo "Hello from new window"',
      new_window: true
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Ran \'echo "Hello from new window"\' in new iTerm window');
  });

  it('fails with invalid command', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'invalidCommand'
    })).rejects.toThrow();
  });

  it('fails running command without cmd parameter', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'runCommand'
    })).rejects.toThrow('Missing "cmd" for runCommand');
  });

  // Test running a more complex command
  it('runs a complex command', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'runCommand',
      cmd: 'ls -la | grep "test"',
      new_window: false
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Ran \'ls -la | grep "test"\'');
  });
}); 