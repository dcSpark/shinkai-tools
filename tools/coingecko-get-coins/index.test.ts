import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_24h_percent: number;
}

describe('CoinGecko Get Coins Tool', () => {
  const toolPath = path.join(__dirname, 'tool.py');
  const client = getToolTestClient();

  it('fetches coins with default parameters', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, {});

    console.log("Response first coin: ", response.coins[0]);

    expect(response).toHaveProperty('coins');
    expect(response).toHaveProperty('total');
    expect(response).toHaveProperty('page');
    expect(response).toHaveProperty('page_size');

    expect(Array.isArray(response.coins)).toBe(true);
    expect(typeof response.total).toBe('number');
    expect(typeof response.page).toBe('number');
    expect(typeof response.page_size).toBe('number');

    expect(response.page).toBe(1);
    expect(response.page_size).toBe(100);
    expect(response.total).toBeGreaterThan(0);
    expect(response.coins.length).toBeLessThanOrEqual(100);

    // Check coin structure with market data
    if (response.coins.length > 0) {
      const firstCoin = response.coins[0];
      expect(firstCoin).toHaveProperty('id');
      expect(firstCoin).toHaveProperty('symbol');
      expect(firstCoin).toHaveProperty('name');
      expect(firstCoin).toHaveProperty('current_price');
      expect(firstCoin).toHaveProperty('market_cap');
      expect(firstCoin).toHaveProperty('total_volume');
      expect(firstCoin).toHaveProperty('price_change_24h_percent');
      expect(typeof firstCoin.id).toBe('string');
      expect(typeof firstCoin.symbol).toBe('string');
      expect(typeof firstCoin.name).toBe('string');
      expect(typeof firstCoin.current_price).toBe('number');
      expect(typeof firstCoin.market_cap).toBe('number');
      expect(typeof firstCoin.total_volume).toBe('number');
      expect(typeof firstCoin.price_change_24h_percent).toBe('number');
    }
  }, 30000);

  it('fetches coins with custom pagination', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      page: 2,
      page_size: 50
    }, {});

    expect(response.page).toBe(2);
    expect(response.page_size).toBe(50);
    expect(response.coins.length).toBeLessThanOrEqual(50);
  }, 30000);

  it('handles invalid page number', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      page: -1
    }, {});

    // Should default to page 1
    expect(response.page).toBe(1);
  });

  it('handles invalid page size', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      page_size: 9999
    }, {});

    // Should default to page_size 100
    expect(response.page_size).toBe(100);
  });

  it('handles pro API configuration', async () => {
    const response = await client.executeToolFromFile(toolPath, {}, {
      api_key: 'dummy_key'
    });

    expect(response).toHaveProperty('coins');
    expect(response.total).toBeGreaterThan(0);
  }, 30000);

  it('can find Solana in the coins list', async () => {
    // We'll fetch a larger page size to increase chances of finding SOL
    const response = await client.executeToolFromFile(toolPath, {
      page_size: 500
    }, {});

    console.log("Looking for Solana in response...");
    
    // Find Solana in the list
    const solana = response.coins.find((coin: CoinData) => 
      coin.id === 'solana' || 
      coin.symbol.toLowerCase() === 'sol' ||
      coin.name.toLowerCase() === 'solana'
    );

    expect(solana).toBeDefined();
    expect(solana).toHaveProperty('id', 'solana');
    expect(solana).toHaveProperty('symbol');
    expect(solana?.symbol.toLowerCase()).toBe('sol');
    expect(solana).toHaveProperty('name');
    expect(solana?.name.toLowerCase()).toBe('solana');
  }, 30000);

  it('sorts coins by market cap in descending order', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      sort_by: 'market_cap',
      sort_direction: 'desc',
      page_size: 10
    }, {});


    console.log("Response coins: ", response.coins);

    expect(response.coins.length).toBeGreaterThan(1);
    
    // Check if sorted correctly
    for (let i = 0; i < response.coins.length - 1; i++) {
      expect(response.coins[i].market_cap).toBeGreaterThanOrEqual(response.coins[i + 1].market_cap);
    }
  }, 30000);

  it('sorts coins by volume in ascending order', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      sort_by: 'volume',
      sort_direction: 'asc',
      page_size: 10
    }, {});

    expect(response.coins.length).toBeGreaterThan(1);
    
    // Check if sorted correctly
    for (let i = 0; i < response.coins.length - 1; i++) {
      expect(response.coins[i].total_volume).toBeLessThanOrEqual(response.coins[i + 1].total_volume);
    }
  }, 30000);

  it('filters coins by minimum volume', async () => {
    const minVolume = 1000000; // $1M minimum volume
    const response = await client.executeToolFromFile(toolPath, {
      min_volume: minVolume
    }, {});

    expect(response.coins.length).toBeGreaterThan(0);
    response.coins.forEach((coin: CoinData) => {
      expect(coin.total_volume).toBeGreaterThanOrEqual(minVolume);
    });
  }, 30000);

  it('filters coins by market cap range', async () => {
    const minMarketCap = 1000000000; // $1B minimum market cap
    const maxMarketCap = 100000000000; // $100B maximum market cap
    
    const response = await client.executeToolFromFile(toolPath, {
      min_market_cap: minMarketCap,
      max_market_cap: maxMarketCap
    }, {});

    expect(response.coins.length).toBeGreaterThan(0);
    response.coins.forEach((coin: CoinData) => {
      expect(coin.market_cap).toBeGreaterThanOrEqual(minMarketCap);
      expect(coin.market_cap).toBeLessThanOrEqual(maxMarketCap);
    });
  }, 30000);

  it('returns prices in different currency', async () => {
    const response = await client.executeToolFromFile(toolPath, {
      vs_currency: 'btc',
      page_size: 10
    }, {});

    expect(response.coins.length).toBeGreaterThan(0);
    response.coins.forEach((coin: CoinData) => {
      expect(coin.current_price).toBeLessThan(1); // Most coins should be worth less than 1 BTC
    });
  }, 30000);
}); 