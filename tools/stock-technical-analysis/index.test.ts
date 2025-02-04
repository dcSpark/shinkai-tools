import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Stock Technical Analysis Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();
  const tiingoApiKey = '';

  it('performs a basic analysis on a known symbol', async () => {
    const response = await client.executeToolFromFile(
      toolPath,
      { symbol: 'AAPL' }, // parameters
      { tiingo_api_key: tiingoApiKey }, // config with API key
      []
    );

    // Check basic response structure
    expect(response).toHaveProperty('analysis');
    expect(typeof response.analysis).toBe('object');

    // Verify fields
    const analysis = response.analysis;
    expect(analysis).toHaveProperty('latestClose');
    expect(analysis).toHaveProperty('aboveSma20');
    expect(analysis).toHaveProperty('aboveSma50');
    expect(analysis).toHaveProperty('aboveSma200');
    expect(analysis).toHaveProperty('sma20OverSma50');
    expect(analysis).toHaveProperty('sma50OverSma200');
    expect(analysis).toHaveProperty('rsi');
    expect(analysis).toHaveProperty('macdBullish');
    expect(analysis).toHaveProperty('atr');
    expect(analysis).toHaveProperty('adrPercent');
    expect(analysis).toHaveProperty('avg20dVolume');

    console.log('Analysis for AAPL:', analysis);
  }, 30000);

  it('performs analysis on Bitcoin (BTCUSD)', async () => {
    const response = await client.executeToolFromFile(
      toolPath,
      { symbol: 'BTCUSD' }, // parameters
      { tiingo_api_key: tiingoApiKey }, // config with API key
      []
    );

    console.log('Response for BTCUSD:', response);

    // Check basic response structure
    expect(response).toHaveProperty('analysis');
    expect(typeof response.analysis).toBe('object');

    // Verify fields
    const analysis = response.analysis;
    expect(analysis).toHaveProperty('latestClose');
    expect(analysis).toHaveProperty('aboveSma20');
    expect(analysis).toHaveProperty('aboveSma50');
    expect(analysis).toHaveProperty('aboveSma200');
    expect(analysis).toHaveProperty('sma20OverSma50');
    expect(analysis).toHaveProperty('sma50OverSma200');
    expect(analysis).toHaveProperty('rsi');
    expect(analysis).toHaveProperty('macdBullish');
    expect(analysis).toHaveProperty('atr');
    expect(analysis).toHaveProperty('adrPercent');
    expect(analysis).toHaveProperty('avg20dVolume');

    console.log('Analysis for BTCUSD:', analysis);
  }, 30000);

  it('throws error if symbol is missing', async () => {
    await expect(
      client.executeToolFromFile(toolPath, {}, { tiingo_api_key: tiingoApiKey })
    ).rejects.toThrow(/Missing 'symbol'/i);
  });

  it('throws error if Tiingo API key is invalid', async () => {
    try {
      await client.executeToolFromFile(toolPath, { symbol: 'NVDA' }, { tiingo_api_key: 'invalid-api-key' });
      throw new Error('Test should have failed with invalid API key');
    } catch (err: any) {
      expect(err.message).toMatch(/(401|403|invalid)/i);
    }
  }, 30000);
}); 