import process from 'node:process';
import axios from 'npm:axios@1.7.7';

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
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

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
