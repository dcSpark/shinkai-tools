import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Chess Move Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('makes a legal move from the start position', async () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const response = await client.executeToolFromFile(toolPath, {
      fen: startFen,
      move_uci: "e2e4"
    });

    console.log(response);

    expect(response).toHaveProperty('new_fen');
    expect(response).toHaveProperty('is_legal', true);
    // newFen should be different from startFen
    expect(typeof response.new_fen).toBe('string');
    expect(response.new_fen).not.toBe(startFen);
  });

  it('rejects an illegal move', async () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const response = await client.executeToolFromFile(toolPath, {
      fen: startFen,
      move_uci: "e2e5" // Pawn can't jump three squares
    });
    expect(response.is_legal).toBe(false);
    // The fen should remain unchanged
    expect(response.new_fen).toBe(startFen);
  });
}); 