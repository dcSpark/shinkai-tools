import process from 'node:process';
import axios from 'npm:axios';

type Configurations = {};
type Parameters = {
  address: string;
};

// {
//   address: # address,
//   ETH: {   # [optional] ETH specific information,
//       balance:    # ETH balance (integer, may be slightly inaccurate on huge numbers),
//       rawBalance: # balance in wei, as a string,
//       totalIn:    # total incoming ETH value (showETHTotals parameter should be set to get this value),
//       totalOut:   # total outgoing ETH value (showETHTotals parameter should be set to get this value)
//   },
//   contractInfo: {  # exists if the address is a contract
//      creatorAddress:  # contract creator address,
//      transactionHash: # contract creation transaction hash,
//      timestamp:       # contract creation timestamp
//   },
//   tokenInfo:  # exists if the specified address is a token contract address (same format as token info),
//   tokens: [   # exists if the specified address has any token balances
//       {
//           tokenInfo:  # token data (same format as token info),
//           balance:    # token balance (integer, may be slightly inaccurate on huge numbers),
//           rawBalance: # exact token balance, as a string,
//           totalIn:    # total incoming token value,
//           totalOut:   # total outgoing token value
//       },
//       ...
//   ],
//   countTxs:    # [optional] total number of incoming and outgoing transactions (including contract creation)
// }

type Result = {
  address: string;
  ETH?: {
    balance: number;
    rawBalance: string;
  };
  tokens?: Array<{
    balance: number;
    rawBalance: string;
  }>;
};

export const run: Run<Configurations, Parameters, Result> = async (
  _configurations,
  parameters,
): Promise<Result> => {
  const url = `https://api.ethplorer.io/getAddressInfo/${parameters.address}?apiKey=freekey`;
  await process.nextTick(() => {});
  const response = await axios.get(url);
  const data = response.data as {
    address: string;
    ETH?: {
      balance: number;
      rawBalance: string;
    };
    tokens?: Array<{
      balance: number;
      rawBalance: string;
      tokenInfo: {
        name: string;
        symbol: string;
        decimals: string;
      };
    }>;
  };

  const result: Result = {
    address: parameters.address,
    ETH: data.ETH,
    tokens: data.tokens?.map((token) => ({
      balance: token.balance,
      rawBalance: token.rawBalance,
      tokenInfo: {
        name: token.tokenInfo.name,
        symbol: token.tokenInfo.symbol,
        decimals: token.tokenInfo.decimals,
      },
    })),
  };

  return Promise.resolve({ ...result });
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-ethplorer-tokens',
  name: 'Token Balance for EVM Ethereum Address - based on ETHPLORER',
  description:
    'Fetches the balance for an Ethereum EVM address like 0x123... and returns detailed token information. ' +
    'Example output: ' +
    '{ "address": "0x123...", "ETH": { "balance": 1.23, "rawBalance": "12300000000000000000" }, ' +
    '"tokens": [ { "balance": 100, "rawBalance": "100000000000000000000", "tokenInfo": { "name": "TokenName", "symbol": "TKN", "decimals": "18" } } ] }',
  author: 'Shinkai',
  keywords: ['ethplorer', 'address', 'tokens', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {},
    required: [],
  },
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string' },
    },
    required: ['address'],
  },
  result: {
    type: 'object',
    properties: {
      address: { type: 'string' },
      ETH: {
        type: 'object',
        nullable: true,
        properties: {
          balance: { type: 'number' },
          rawBalance: { type: 'string' },
        },
        required: ['balance', 'rawBalance'],
      },
      tokens: {
        type: 'array',
        nullable: true,
        items: {
          type: 'object',
          properties: {
            balance: { type: 'number' },
            rawBalance: { type: 'string' },
          },
          required: ['balance', 'rawBalance'],
        },
      },
    },
    required: ['address'],
  },
};
