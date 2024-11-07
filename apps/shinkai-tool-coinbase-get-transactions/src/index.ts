import { Coinbase, CoinbaseOptions } from 'npm:@coinbase/coinbase-sdk@0.0.16';

type Configurations = {
  name: string;
  privateKey: string;
  walletId: string;
};
type Parameters = {};
type Result = { tableCsv: string; rowsCount: number; columnsCount: number };

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

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-coinbase-get-transactions',
  name: 'Shinkai: Coinbase Transactions Getter',
  description:
    'Tool for getting the transactions of a Coinbase wallet after restoring it',
  author: 'Shinkai',
  keywords: ['coinbase', 'balance', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      privateKey: { type: 'string' },
      walletId: { type: 'string' },
    },
    required: ['name', 'privateKey', 'walletId'],
  },
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  result: {
    type: 'object',
    properties: {
      tableCsv: { type: 'string' },
      rowsCount: { type: 'number' },
      columnsCount: { type: 'number' },
    },
    required: ['tableCsv', 'rowsCount', 'columnsCount'],
  },
};
