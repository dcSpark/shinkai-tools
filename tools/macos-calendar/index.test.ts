import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('macos-calendar Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('adds an event', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'addEvent',
      title: 'Test Event',
      start_date: '2025-01-01 10:00:00',
      end_date: '2025-01-01 11:00:00',
      calendar_name: 'Calendar'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toBe('Event added: Test Event');
  });

  it('adds an event with default calendar', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'addEvent',
      title: 'Test Event Default Calendar',
      start_date: '2025-01-02 14:00:00',
      end_date: '2025-01-02 15:00:00'
    });
    expect(response).toHaveProperty('result');
    expect(response.result).toBe('Event added: Test Event Default Calendar');
  });

  it('lists today\'s events', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'listToday'
    });
    console.log(response);
    expect(response).toHaveProperty('result');
    // Could be either "No events today" or a list of events
    expect(typeof response.result).toBe('string');
  }, 15000);

  it('lists this week\'s events', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      command: 'listWeek'
    });
    console.log(response);
    expect(response).toHaveProperty('result');
    // Could be either "No events this week" or a list of events
    expect(typeof response.result).toBe('string');
  }, 15000);

  it('fails with invalid command', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'invalidCommand'
    })).rejects.toThrow();
  });

  it('fails adding event without title', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'addEvent',
      start_date: '2025-01-01 10:00:00',
      end_date: '2025-01-01 11:00:00'
    })).rejects.toThrow('Missing "title", "start_date", or "end_date" for addEvent');
  });

  it('fails adding event without start date', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'addEvent',
      title: 'Test Event',
      end_date: '2025-01-01 11:00:00'
    })).rejects.toThrow('Missing "title", "start_date", or "end_date" for addEvent');
  });

  it('fails adding event without end date', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      command: 'addEvent',
      title: 'Test Event',
      start_date: '2025-01-01 10:00:00'
    })).rejects.toThrow('Missing "title", "start_date", or "end_date" for addEvent');
  });
});