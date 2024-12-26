import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk@0.0.16';

type Configurations = {
  name: string;
  privateKey: string;
  walletId: string;
};
type Parameters = {};
type Result = { tableCsv: string; rowsCount: number; columnsCount: number };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  _parameters: Parameters,
): Promise<Result> => {
  const coinbaseOptions: CoinbaseOptions = {
    apiKeyName: configurations.name,
    privateKey: configurations.privateKey,
  };
  const coinbase = new Coinbase(coinbaseOptions);
  const user = await coinbase.getDefaultUser();

  // Prioritize walletId from Params over Config
  const walletId = configurations.walletId;

  const wallet = await user.getWallet(walletId);
  console.log(`Wallet retrieved: `, wallet.toString());

  // Retrieve the list of balances for the wallet
  const address = await wallet.getDefaultAddress();
  const transactions = (await address?.listTransfers()) ?? [];

  // Convert transactions to CSV format
  const headers = [
    'transferId',
    'networkId',
    'fromAddressId',
    'destinationAddressId',
    'assetId',
    'amount',
    'transactionHash',
    'transactionLink',
    'status',
  ];
  const rows = transactions.map((tx) => [
    tx.getId(),
    tx.getNetworkId(),
    tx.getFromAddressId(),
    tx.getDestinationAddressId(),
    tx.getAssetId(),
    tx.getAmount().toString(),
    tx.getTransactionHash(),
    tx.getTransactionLink(),
    tx.getStatus(),
  ]);
  const tableCsv = [headers, ...rows].map((row) => row.join(';')).join('\n');

  return Promise.resolve({
    tableCsv,
    rowsCount: transactions.length,
    columnsCount: headers.length,
  });
};
