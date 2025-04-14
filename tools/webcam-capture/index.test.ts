import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';
import * as fs from 'fs';

describe('Webcam Capture Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('captures a frame with default config', async () => {
    // Attempt to run the tool with default configuration
    const response = await client.executeToolFromFile(
      toolPath,
      {},       // No input parameters => uses default
      {}        // No special config => uses default "cameraIndex=0" & "format=png"
    );

    console.log(response);

    // Validate shape
    expect(response).toHaveProperty('__created_files__');
    expect(Array.isArray(response.__created_files__)).toBe(true);
    expect(response.__created_files__[0]).toMatch(/webcam_capture_\d+\.png$/);

    expect(response).toHaveProperty('imagePath');
    expect(typeof response.imagePath).toBe('string');
    expect(response.imagePath).toMatch(/webcam_capture_\d+\.png$/);

    // Check if file exists
    expect(fs.existsSync(response.imagePath)).toBe(true);

    // Check dimensions
    expect(response).toHaveProperty('width', 640);  // Default width
    expect(response).toHaveProperty('height', 480); // Default height
  }, 120000);

  it('captures a frame as JPEG with custom config', async () => {
    const response = await client.executeToolFromFile(
      toolPath,
      { width: 800, height: 600 }, // Input parameters
      { cameraIndex: 0, format: 'jpeg' } // Config
    );

    expect(response).toHaveProperty('__created_files__');
    expect(Array.isArray(response.__created_files__)).toBe(true);
    expect(response.__created_files__[0]).toMatch(/webcam_capture_\d+\.jpeg$/);

    expect(response).toHaveProperty('imagePath');
    expect(typeof response.imagePath).toBe('string');
    expect(response.imagePath).toMatch(/webcam_capture_\d+\.jpeg$/);

    // Check if file exists
    expect(fs.existsSync(response.imagePath)).toBe(true);

    // Check dimensions
    expect(response).toHaveProperty('width', 800);
    expect(response).toHaveProperty('height', 600);
  }, 120000);

  it('handles invalid camera device gracefully', async () => {
    try {
      await client.executeToolFromFile(
        toolPath,
        {},
        { cameraIndex: 999999, format: 'png' }
      );
      fail('Should have thrown an error for invalid camera index');
    } catch (err: any) {
      expect(err.message).toMatch(/Failed to open webcam/i);
    }
  }, 20000);
}); 