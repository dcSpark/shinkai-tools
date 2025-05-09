interface CONFIG extends Record<string, never> {}
interface INPUTS extends Record<string, never> {}

interface STABLECOIN { 
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  coinmarketcap_name: string;
  daily_volume_march_snapshot: number; // Added parameter
  tags: string[]; // Assuming tags are also needed
}

interface OUTPUT {
  stableCoins: STABLECOIN[];
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const endpoint = 'https://api.shinkai.com/solana/query/stablecoin';
  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new Error(`Error fetching stablecoins: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format: expected an array of stablecoins');
    }

    const stableCoins = data.map((coin: any) => ({
      name: coin.name,
      symbol: coin.symbol,
      address: coin.address,
      decimals: coin.decimals,
      coinmarketcap_name: coin.coinmarketcap_name,
      daily_volume_march_snapshot: coin.daily_volume_march_snapshot,
      tags: coin.tags
    }));

    return { stableCoins };
  } catch (error) {
    throw new Error(`Failed to fetch stablecoins: ${error instanceof Error ? error.message : String(error)}`);
  }
}