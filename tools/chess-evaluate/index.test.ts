import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Chess Evaluate Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('evaluates the starting position', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      depth: 10
    });
    console.log(response);

    expect(response).toHaveProperty('message');
    // Could be "Evaluation: X centipawns" or "Mate in ...", etc.
    // Just check it doesn't throw
    expect(typeof response.message).toBe('string');
    expect(response.message.length).toBeGreaterThan(0);
  }, 20000);

  it('handles invalid FEN', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      fen: "not-a-valid-FEN"
    })).rejects.toThrow(/Invalid FEN/);
  }, 10000);
}); 