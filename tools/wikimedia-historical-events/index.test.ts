import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Wikimedia Historical Events Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('fetches historical events with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, {});
    console.log("Response: ", response);

    expect(response).toHaveProperty('events');
    expect(response.events).toHaveProperty('selected_date');
    expect(response.events).toHaveProperty('events');
    expect(response.events).toHaveProperty('births');
    expect(response.events).toHaveProperty('deaths');
    expect(response.events).toHaveProperty('holidays');

    if (response.events.events && response.events.events.length > 0) {
      const firstEvent = response.events.events[0];
      expect(firstEvent).toHaveProperty('text');
      expect(firstEvent).toHaveProperty('year');
      expect(firstEvent).toHaveProperty('links');
      expect(Array.isArray(firstEvent.links)).toBe(true);
    }
  }, 30000);

  it('respects type parameter for specific event types', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      type: 'births'
    });

    expect(response.events).toHaveProperty('births');
    expect(response.events).not.toHaveProperty('events');
    expect(response.events).not.toHaveProperty('deaths');
    expect(response.events).not.toHaveProperty('holidays');

    if (response.events.births && response.events.births.length > 0) {
      const firstBirth = response.events.births[0];
      expect(firstBirth).toHaveProperty('text');
      expect(firstBirth).toHaveProperty('year');
      expect(firstBirth).toHaveProperty('links');
    }
  }, 30000);

  it('handles custom date parameter', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      date: '2024-01-01'
    });

    expect(response.events.selected_date).toBe('2024-01-01');
    expect(response.events).toHaveProperty('events');
  }, 30000);

  it('handles custom language', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, {
      language: 'fr'
    });

    if (response.events.events && response.events.events.length > 0) {
      const firstEvent = response.events.events[0];
      if (firstEvent.links.length > 0) {
        expect(firstEvent.links[0].url).toMatch(/^https:\/\/fr\.wikipedia\.org\/wiki\//);
      }
    }
  }, 30000);
});
