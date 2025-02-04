import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Coin Flip Tool', () => {
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('flips a coin with default parameters (3 sides)', async () => {
    const response = await client.executeToolFromFile(toolPath, {});

    expect(response).toHaveProperty('result');
    expect(['-', '0', '+']).toContain(response.result);
  });

  it('flips a coin with custom sides', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      sides: 2
    });

    expect(response).toHaveProperty('result');
    expect(['heads', 'tails']).toContain(response.result);
  });

  it('flips a coin with custom side names', async () => {
    const sideNames = ['past', 'present', 'future'];
    const response = await client.executeToolFromFile(toolPath, {
      sides: 3,
      sideNames
    });

    expect(response).toHaveProperty('result');
    expect(sideNames).toContain(response.result);
  });

  it('handles invalid side names length', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      sides: 2,
      sideNames: ['one', 'two', 'three']
    });

    expect(response).toHaveProperty('error');
    expect(response.error).toContain('Number of side names');
  });

  it('handles negative sides', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      sides: -1
    });

    expect(response).toHaveProperty('error');
    expect(response.error).toContain('negative sides');
  });
});
