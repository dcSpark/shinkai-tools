import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('CoinGecko Get Historical Data Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  const defaultParams = {
    id: 'bitcoin',
    vs_currency: 'usd',
    from_date: '2024-01-01',
    to_date: '2024-01-02'
  };

  it('fetches historical data with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, defaultParams, {});

    console.log("Response summary:", response.summary);
    console.log("First data point:", response.data_points[0]);

    // Check basic response structure
    expect(response).toHaveProperty('from_date');
    expect(response).toHaveProperty('to_date');
    expect(response).toHaveProperty('data_points');
    expect(response).toHaveProperty('summary');
    expect(response).toHaveProperty('currency');
    expect(response).toHaveProperty('coin_id');

    // Verify dates match input
    expect(response.from_date).toBe(defaultParams.from_date);
    expect(response.to_date).toBe(defaultParams.to_date);
    expect(response.currency).toBe(defaultParams.vs_currency);
    expect(response.coin_id).toBe(defaultParams.id);

    // Check data points structure
    expect(Array.isArray(response.data_points)).toBe(true);
    expect(response.data_points.length).toBeGreaterThan(0);

    // Verify data point format
    const firstPoint = response.data_points[0];
    expect(firstPoint).toHaveProperty('timestamp');
    expect(firstPoint).toHaveProperty('datetime');
    expect(firstPoint).toHaveProperty('price_usd');
    expect(firstPoint).toHaveProperty('market_cap_usd');
    expect(firstPoint).toHaveProperty('volume_usd');

    // Check data types
    expect(typeof firstPoint.timestamp).toBe('number');
    expect(typeof firstPoint.datetime).toBe('string');
    expect(typeof firstPoint.price_usd).toBe('number');
    expect(typeof firstPoint.market_cap_usd).toBe('number');
    expect(typeof firstPoint.volume_usd).toBe('number');

    // Verify summary statistics
    expect(response.summary).toHaveProperty('price_change');
    expect(response.summary).toHaveProperty('price_change_percentage');
    expect(response.summary).toHaveProperty('highest_price');
    expect(response.summary).toHaveProperty('lowest_price');
    expect(response.summary).toHaveProperty('average_price');
    expect(response.summary).toHaveProperty('highest_volume');
    expect(response.summary).toHaveProperty('total_volume');
    expect(response.summary).toHaveProperty('number_of_data_points');

    // Check summary data types
    expect(typeof response.summary.price_change).toBe('number');
    expect(typeof response.summary.price_change_percentage).toBe('number');
    expect(typeof response.summary.highest_price).toBe('number');
    expect(typeof response.summary.lowest_price).toBe('number');
    expect(typeof response.summary.average_price).toBe('number');
    expect(response.summary.number_of_data_points).toBeGreaterThan(0);
  }, 30000);

  it('fetches historical data with custom interval', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      ...defaultParams,
      interval: 'hourly'
    }, {});

    expect(response.interval).toBe('hourly');
    expect(response.data_points.length).toBeGreaterThan(0);
    expect(response.summary.number_of_data_points).toBeGreaterThan(0);
  }, 30000);

  it('handles invalid date format', async () => {
    await expect(
      client.executeToolFromFile(toolPath, {
        ...defaultParams,
        from_date: '01-01-2024' // wrong format
      }, {})
    ).rejects.toThrow('Invalid date format');
  });

  it('handles missing required parameters', async () => {
    await expect(
      client.executeToolFromFile(toolPath, {
        id: 'bitcoin'
        // missing other required params
      }, {})
    ).rejects.toThrow('Missing required parameters');
  });

  it('handles invalid interval value', async () => {
    await expect(
      client.executeToolFromFile(toolPath, {
        ...defaultParams,
        interval: 'invalid'
      }, {})
    ).rejects.toThrow('interval must be one of');
  });

  it('handles pro API configuration', async () => {
    const response = await client.executeToolFromFile(toolPath, defaultParams, {
      api_key: 'dummy_key'
    });

    expect(response).toHaveProperty('data_points');
    expect(response.data_points.length).toBeGreaterThan(0);
  }, 30000);

  it('fetches Solana historical data with daily interval', async () => {
    const solanaParams = {
      id: 'solana',
      vs_currency: 'usd',
      from_date: '2024-01-01',
      to_date: '2024-01-07', // A week of data
      interval: 'daily'
    };

    const response = await client.executeToolFromFile(toolPath, solanaParams, {});

    console.log("Solana summary:", response.summary);
    console.log("First Solana data point:", response.data_points[0]);

    expect(response.coin_id).toBe('solana');
    expect(response.currency).toBe('usd');
    expect(response.interval).toBe('daily');

    // Verify we got data
    expect(response.data_points.length).toBeGreaterThan(0);
    expect(response.summary.number_of_data_points).toBeGreaterThan(0);

    // Check price data format
    const firstPoint = response.data_points[0];
    expect(firstPoint.price_usd).toBeGreaterThan(0); // Solana price should be positive
    expect(firstPoint.market_cap_usd).toBeGreaterThan(0);
    expect(firstPoint.volume_usd).toBeGreaterThan(0);

    // Check we have roughly 7 days of data (might be 6-8 depending on API)
    expect(response.data_points.length).toBeGreaterThanOrEqual(6);
    expect(response.data_points.length).toBeLessThanOrEqual(8);

    // Verify summary statistics are meaningful
    expect(response.summary.highest_price).toBeGreaterThan(0);
    expect(response.summary.lowest_price).toBeGreaterThan(0);
    expect(response.summary.average_price).toBeGreaterThan(0);
    expect(response.summary.total_volume).toBeGreaterThan(0);
  }, 30000);
}); 