import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { Coinbase, CoinbaseOptions, Wallet, Balance as BalanceModel } from '@coinbase/coinbase-sdk';
import { Decimal } from 'decimal.js';

type Config = {
  name: string;
  privateKey: string;
  walletId?: string;
  useServerSigner?: string;
};
type Params = {
  walletId?: string;
};
type Result = {
  message: string;
  balances: WalletBalances | null;
};

type WalletBalances = { [key: string]: number };

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
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
        balances: { type: 'object', nullable: true },
      },
      required: ['message'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const coinbaseOptions: CoinbaseOptions = {
      apiKeyName: this.config.name,
      privateKey: this.config.privateKey,
      useServerSigner: this.config.useServerSigner === 'true',
      debugging: true,
    };
    const coinbase = new Coinbase(coinbaseOptions);
    const user = await coinbase.getDefaultUser();

    // Prioritize walletId from Params over Config
    const walletId = params.walletId || this.config.walletId;

    // Throw an error if walletId is not defined
    if (!walletId) {
      throw new Error('walletId must be defined in either params or config');
    }

    const wallet = await user.getWallet(walletId);
    console.log(`Wallet retrieved: `, wallet.toString());

    // Retrieve the list of balances for the wallet
    let balances = await wallet.listBalances();
    console.log(`Balances: `, balances);

    // Convert balances to WalletBalances
    const balanceMap: WalletBalances = {};
    for (const [currency, amount] of balances) {
      balanceMap[currency] = amount.toNumber();
    }

    return {
      data: {
        message: `Balances: ${JSON.stringify(balanceMap)}`,
        balances: balanceMap,
      },
    };
  }
}
