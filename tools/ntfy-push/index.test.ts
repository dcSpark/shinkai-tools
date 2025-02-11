import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Ntfy Push Notification Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('sends a basic notification successfully', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      topic: 'test-topic',
      message: 'Test notification message'
    });

    expect(response.success).toBe(true);
    expect(response.message).toBe('Notification sent successfully');
  });

  it('sends a notification with all optional parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      topic: 'test-topic',
      message: 'Test notification with options',
      title: 'Test Title',
      priority: 'high',
      tags: 'warning,test'
    });

    expect(response.success).toBe(true);
    expect(response.message).toBe('Notification sent successfully');
  });
});
