import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { Coinbase, CoinbaseOptions, Wallet } from '@coinbase/coinbase-sdk';

type Config = {
  name: string;
  privateKey: string;
  walletId: string;
  useServerSigner?: string;
};
type Params = {};
type Result = { tableCsv: string; rowsCount: number; columnsCount: number };

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
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
        useServerSigner: { type: 'string', nullable: true },
      },
      required: ['name', 'privateKey', 'walletId'],
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
        tableCsv: { type: 'string' },
        rowsCount: { type: 'number' },
        columnsCount: { type: 'number' },
      },
      required: ['tableCsv', 'rowsCount', 'columnsCount'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const coinbaseOptions: CoinbaseOptions = {
      apiKeyName: this.config.name,
      privateKey: this.config.privateKey,
      useServerSigner: this.config.useServerSigner === 'true',
    };
    const coinbase = new Coinbase(coinbaseOptions);

    // Prioritize walletId from Params over Config
    const walletId = this.config.walletId;

    let wallet = await Wallet.fetch(walletId);
    console.log(`Wallet retrieved: `, wallet.toString());

    // Retrieve the list of balances for the wallet
    let address = await wallet.getDefaultAddress();
    let transactions = (await address?.listTransfers()) ?? [];

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
      data: {
        tableCsv,
        rowsCount: transactions.length,
        columnsCount: headers.length,
      },
    });
  }
}
