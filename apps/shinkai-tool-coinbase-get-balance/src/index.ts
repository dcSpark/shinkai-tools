import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk@0.0.16';

type WalletBalances = { [key: string]: number };

type Configurations = {
  name: string;
  privateKey: string;
  walletId?: string;
  useServerSigner?: string;
};
type Parameters = {
  walletId?: string;
};
type Result = {
  message: string;
  balances: WalletBalances | null;
};

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  params,
): Promise<Result> => {
  const coinbaseOptions: CoinbaseOptions = {
    apiKeyName: configurations.name,
    privateKey: configurations.privateKey,
    useServerSigner: configurations.useServerSigner === 'true',
    debugging: true,
  };
  const coinbase = new Coinbase(coinbaseOptions);
  const user = await coinbase.getDefaultUser();

  // Prioritize walletId from Params over Config
  const walletId = params.walletId || configurations.walletId;

  // Throw an error if walletId is not defined
  if (!walletId) {
    throw new Error('walletId must be defined in either params or config');
  }

  const wallet = await user.getWallet(walletId);
  console.log(`Wallet retrieved: `, wallet.toString());

  // Retrieve the list of balances for the wallet
  const balances = await wallet.listBalances();
  console.log(`Balances: `, balances);

  // Convert balances to WalletBalances
  const balanceMap: WalletBalances = {};
  for (const [currency, amount] of balances) {
    balanceMap[currency] = amount.toNumber();
  }

  return {
    message: `Balances: ${JSON.stringify(balanceMap)}`,
    balances: balanceMap,
  };
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-coinbase-get-balance',
  name: 'Shinkai: Coinbase Balance Getter',
  description:
    'Tool for getting the balance of a Coinbase wallet after restoring it',
  author: 'Shinkai',
  keywords: ['coinbase', 'balance', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      privateKey: { type: 'string' },
      walletId: { type: 'string', nullable: true },
      useServerSigner: { type: 'string', nullable: true },
    },
    required: ['name', 'privateKey'],
  },
  parameters: {
    type: 'object',
    properties: {
      walletId: { type: 'string', nullable: true },
    },
    required: [],
  },
  result: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      balances: {
        type: 'object',
        additionalProperties: {
          type: 'number',
        },
        required: [],
      },
    },
    required: ['message', 'balances'],
  },
};
