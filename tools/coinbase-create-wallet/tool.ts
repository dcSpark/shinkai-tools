import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk@0.0.16';

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
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

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
