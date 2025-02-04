import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';
import * as fs from 'fs';

describe('Chess Generate Image Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('generates an image for the starting position', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      output_filename: "test_starting_position.png"
    });

    console.log(response);

    expect(response).toHaveProperty('image_path');
    expect(typeof response.image_path).toBe('string');
    expect(response.image_path).toContain('test_starting_position.png');
    expect(fs.existsSync(response.image_path)).toBe(true);
    
    // Check if file is a valid PNG
    const fileBuffer = fs.readFileSync(response.image_path);
    expect(fileBuffer.length).toBeGreaterThan(0);
    expect(fileBuffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a'); // PNG magic number
  }, 20000);

  it('generates an image with highlighted last move', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      last_move_uci: "e2e4",
      output_filename: "test_with_highlight.png"
    });

    console.log(response);

    expect(response).toHaveProperty('image_path');
    expect(typeof response.image_path).toBe('string');
    expect(response.image_path).toContain('test_with_highlight.png');
    expect(fs.existsSync(response.image_path)).toBe(true);
    
    const fileBuffer = fs.readFileSync(response.image_path);
    expect(fileBuffer.length).toBeGreaterThan(0);
    expect(fileBuffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
  }, 20000);

  it('handles invalid FEN', async () => {
    await expect(client.executeToolFromFile(toolPath, {
      fen: "not-a-valid-FEN"
    })).rejects.toThrow(/Invalid FEN/);
  }, 10000);

  it('handles invalid last_move_uci', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      last_move_uci: "invalid-move",
      output_filename: "test_invalid_move.png"
    });

    expect(response).toHaveProperty('image_path');
    expect(typeof response.image_path).toBe('string');
    expect(response.image_path).toContain('test_invalid_move.png');
    expect(fs.existsSync(response.image_path)).toBe(true);
    
    const fileBuffer = fs.readFileSync(response.image_path);
    expect(fileBuffer.length).toBeGreaterThan(0);
    expect(fileBuffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
  }, 20000);
}); 