import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('macos-notifications Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('sends notification with sound', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'sendNotification',
      title: 'Test Notification',
      message: 'This is a test notification with sound',
      sound: true
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toBe('Notification sent');
  });

  it('sends notification without sound', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'sendNotification',
      title: 'Silent Test',
      message: 'This is a test notification without sound',
      sound: false
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toBe('Notification sent');
  });

  it('toggles do not disturb', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'toggleDoNotDisturb'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toBe('Toggled Do Not Disturb');
  });

  it('fails with invalid command', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'invalidCommand'
    })).rejects.toThrow();
  });

  it('fails sending notification without title', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'sendNotification',
      message: 'Test message'
    })).rejects.toThrow('Missing "title" or "message" for sendNotification');
  });

  it('fails sending notification without message', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'sendNotification',
      title: 'Test title'
    })).rejects.toThrow('Missing "title" or "message" for sendNotification');
  });
}); 