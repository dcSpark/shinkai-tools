import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk@0.0.16';

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
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

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
