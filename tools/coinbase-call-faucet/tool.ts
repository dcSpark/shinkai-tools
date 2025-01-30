import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk@0.0.16';

type Configurations = {
  name: string;
  privateKey: string;
  walletId?: string;
};
type Parameters = {};
type Result = {
  data: string;
};
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  _params,
): Promise<Result> => {
  const coinbaseOptions: CoinbaseOptions = {
    apiKeyName: configurations.name,
    privateKey: configurations.privateKey,
  };
  const coinbase = new Coinbase(coinbaseOptions);
  console.log(`Coinbase configured: `, coinbase);
  const user = await coinbase.getDefaultUser();
  console.log(`User: `, user);

  // Use walletId from Config only
  const walletId = configurations.walletId;

  let wallet;
  if (walletId) {
    // Retrieve existing Wallet using walletId
    wallet = await user.getWallet(walletId);
    console.log(`Wallet retrieved: `, wallet.toString());
  } else {
    // Create a new Wallet for the User
    wallet = await user.createWallet({
      networkId: Coinbase.networks.BaseSepolia,
    });
    console.log(`Wallet successfully created: `, wallet.toString());
  }

  const faucetTransaction = await wallet.faucet();
  console.log(
    `Faucet transaction completed successfully: `,
    faucetTransaction.toString(),
  );

  return {
    data: `Faucet transaction completed successfully: ${faucetTransaction.toString()} for wallet: ${wallet.getDefaultAddress()}`,
  };
};

