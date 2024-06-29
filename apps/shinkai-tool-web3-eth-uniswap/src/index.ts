import { weieth } from 'micro-eth-signer';
import { ArchiveNodeProvider } from 'micro-eth-signer/net';
import {
  BaseTool,
  RunResult,
  ToolDefinition,
} from '@shinkai_protocol/shinkai-tools-builder';

type Config = {};

type Params = {
  address: string;
};

type Result = { balance: string };

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-web3-eth-uniswap',
    name: 'Shinkai: Web3 ETH Uniswap',
    description:
      'Fetches the balance of an Ethereum address in ETH using Uniswap.',
    author: 'Shinkai',
    keywords: ['ethereum', 'balance', 'web3', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {},
      required: [],
    },
    parameters: {
      type: 'object',
      required: ['address'],
      properties: {
        address: { type: 'string' },
      },
    },
    result: {
      type: 'object',
      properties: {
        balance: { type: 'string' },
      },
      required: ['balance'],
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
    console.log('Provider created');

    try {
      const { balance } = await provider.unspent(params.address);
      const balanceInEth = weieth.encode(balance);
      return {
        data: { balance: `Balance of ${params.address}: ${balanceInEth} ETH` },
      };
    } catch (error) {
      if (error instanceof Error) {
        return { data: { balance: `Error: ${error.message}` } };
      } else {
        return { data: { balance: `An unknown error occurred` } };
      }
    }
  }
}
