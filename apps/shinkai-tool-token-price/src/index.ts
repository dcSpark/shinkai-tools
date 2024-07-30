import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { ArchiveNodeProvider, Chainlink } from 'micro-eth-signer/net';

type Config = {};
type Params = {
  symbol: string;
};

type Result = {
  symbol: string;
  price: number | null;
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-chainlink-price',
    name: 'Shinkai: Chainlink Price',
    description: 'Fetches the price of a coin or token using Chainlink.',
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
        price: { type: 'number', nullable: true },
      },
      required: ['symbol', 'price'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const provider = new ArchiveNodeProvider({
      call: async (method: string, ...args: any[]) => {
        const response = await fetch('https://eth.llamarpc.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params: args,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        type Response = { error: any; result: any };
        const data = (await response.json()) as Response;
        if (data.error) {
          throw new Error(data.error.message);
        }

        return data.result;
      },
    });

    const link = new Chainlink(provider);
    let price: number | null = null;

    try {
      price = await link.coinPrice(params.symbol);
    } catch (coinError) {
      try {
        price = await link.tokenPrice(params.symbol);
      } catch (tokenError) {
        console.error(`Failed to fetch price for symbol: ${params.symbol}`);
      }
    }

    const result: Result = {
      symbol: params.symbol,
      price,
    };

    return Promise.resolve({ data: result });
  }
}
