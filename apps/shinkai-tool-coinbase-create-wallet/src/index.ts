import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk';

type Configurations = {
  name: string;
  privateKey: string;
  useServerSigner?: string;
};
type Parameters = {}; // Params type is now empty
type Result = {
  walletId?: string;
  seed?: string;
  address?: string;
};

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  _parameters: Parameters,
): Promise<Result> => {
  const coinbaseOptions: CoinbaseOptions = {
    apiKeyName: configurations.name,
    privateKey: configurations.privateKey,
    useServerSigner: configurations.useServerSigner === 'true',
  };
  const coinbase = new Coinbase(coinbaseOptions);
  console.log(`Coinbase configured: `, coinbase);
  const user = await coinbase.getDefaultUser();
  console.log(`User: `, user);

  // Create a new Wallet for the User
  const wallet = await user.createWallet({
    networkId: Coinbase.networks.BaseSepolia,
  });
  console.log(`Wallet successfully created: `, wallet.toString());

  let exportedWallet;
  if (!configurations.useServerSigner) {
    exportedWallet = await wallet.export();
  }

  const address = await wallet.getDefaultAddress();

  return {
    ...exportedWallet,
    walletId: wallet.getId(),
    address: address?.getId(),
  };
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-coinbase-create-wallet',
  name: 'Shinkai: Coinbase Wallet Creator',
  description: 'Tool for creating a Coinbase wallet',
  author: 'Shinkai',
  keywords: ['coinbase', 'wallet', 'creator', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      privateKey: { type: 'string' },
      useServerSigner: { type: 'string', default: 'false', nullable: true },
    },
    required: ['name', 'privateKey'],
  },
  parameters: {
    type: 'object',
    properties: {},
    required: [], // No required parameters
  },
  result: {
    type: 'object',
    properties: {
      walletId: { type: 'string', nullable: true },
      seed: { type: 'string', nullable: true },
      address: { type: 'string', nullable: true },
    },
    required: [],
  },
};
