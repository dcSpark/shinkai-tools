import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk';

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
  address: string;
};

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters,
): Promise<Result> => {
  const coinbaseOptions: CoinbaseOptions = {
    apiKeyName: configurations.name,
    privateKey: configurations.privateKey,
    useServerSigner: configurations.useServerSigner === 'true',
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
  const address = await wallet.getDefaultAddress();
  console.log(`Default Address: `, address);

  return {
    address: address?.getId() || '',
  };
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-coinbase-get-my-address',
  name: 'Shinkai: Coinbase My Address Getter',
  description: 'Tool for getting the default address of a Coinbase wallet',
  author: 'Shinkai',
  keywords: ['coinbase', 'address', 'shinkai'],
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
      address: { type: 'string' },
    },
    required: ['address'],
  },
};
