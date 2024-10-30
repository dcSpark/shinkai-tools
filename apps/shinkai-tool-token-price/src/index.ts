import { ArchiveNodeProvider, Chainlink } from 'npm:micro-eth-signer/net';
import axios from 'npm:axios';
import process from 'node:process';

type Configurations = {};
type Parameters = {
  symbol: string;
};

type Result = {
  symbol: string;
  price: number | null;
};

export const run: Run<Configurations, Parameters, Result> = async (
  _configurations,
  parameters,
): Promise<Result> => {
  const provider = new ArchiveNodeProvider({
    call: async (method: string, ...args: any[]) => {
      try {
        await process.nextTick(() => {});
        const response = await axios.post(
          'https://eth.llamarpc.com',
          {
            jsonrpc: '2.0',
            id: 1,
            method,
            params: args,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.data.error) {
          throw new Error(response.data.error.message);
        }
        return response.data.result;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new Error(`HTTP error! status: ${error.response?.status}`);
        }
        throw error;
      }
    },
  });

  const link = new Chainlink(provider);
  let price: number | null = null;

  try {
    price = await link.coinPrice(parameters.symbol);
  } catch (coinError) {
    try {
      price = await link.tokenPrice(parameters.symbol);
    } catch (tokenError) {
      console.error(`Failed to fetch price for symbol: ${parameters.symbol}`);
    }
  }

  const result: Result = {
    symbol: parameters.symbol,
    price,
  };

  return Promise.resolve({ ...result });
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-token-price',
  name: 'Shinkai: Token Price using Chainlink (Limited)',
  description:
    "Fetches the price of a coin or token using Chainlink. It doesn't have many tokens.",
  author: 'Shinkai',
  keywords: ['chainlink', 'price', 'symbol', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {},
    required: [],
  },
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string' },
    },
    required: ['symbol'],
  },
  result: {
    type: 'object',
    properties: {
      symbol: { type: 'string' },
      price: { type: 'number' },
    },
    required: ['symbol', 'price'],
  },
};
