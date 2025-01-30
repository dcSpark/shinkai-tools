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
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

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
