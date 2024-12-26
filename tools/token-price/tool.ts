import { ArchiveNodeProvider, Chainlink } from 'npm:micro-eth-signer@0.10.0/net';
import axios from 'npm:axios@1.7.7';
import process from 'node:process';

type Configurations = {};
type Parameters = {
  symbol: string;
};

type Result = {
  symbol: string;
  price: number | null;
};
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

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
  } catch (_coinError) {
    try {
      price = await link.tokenPrice(parameters.symbol);
    } catch (_tokenError) {
      console.error(`Failed to fetch price for symbol: ${parameters.symbol}`);
    }
  }

  const result: Result = {
    symbol: parameters.symbol,
    price,
  };

  return Promise.resolve({ ...result });
};
