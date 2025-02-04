import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('macos-system Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('sets volume level', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'setVolume',
      level: 50
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Volume set to 50%');
  });

  it('gets frontmost app', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'getFrontmostApp'
    });
    expect(response).toHaveProperty('result');
    expect(typeof response.result).toBe('string');
  });

  it('launches an app', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'launchApp',
      app_name: 'Finder'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Launched Finder');
  });

  it('quits an app', async () => {
    // First launch an app
    await client.executeToolFromFile(toolPath, {
      command: 'launchApp',
      app_name: 'Calculator'
    });

    // Then quit it
    const response = await client.executeToolFromFile(toolPath, {
      command: 'quitApp',
      app_name: 'Calculator'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Quit Calculator');
  });

  it('force quits an app', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'quitApp',
      app_name: 'Calculator',
      force: true
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toContain('Quit Calculator');
  });

  it('toggles dark mode', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'toggleDarkMode'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toMatch(/Dark mode is now (true|false)/);
  });

  it('gets battery status', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'getBatteryStatus'
    });
    expect(response).toHaveProperty('result');
    expect(typeof response.result).toBe('string');
  });

  it('fails with invalid command', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'invalidCommand'
    })).rejects.toThrow();
  });

  it('fails setting volume without level', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'setVolume'
    })).rejects.toThrow('Missing "level" for setVolume');
  });

  it('fails launching app without app_name', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'launchApp'
    })).rejects.toThrow('Missing "app_name" for launchApp');
  });
}); 