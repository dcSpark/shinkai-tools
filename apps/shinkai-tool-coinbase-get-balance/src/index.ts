import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { Coinbase, CoinbaseOptions } from '@coinbase/coinbase-sdk';

type Config = {
  name: string;
  privateKey: string;
  walletId?: string;
};
type Params = {
  walletId?: string;
};
type Result = {
  data: string;
};

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
        data: { type: 'string' },
      },
      required: ['data'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const coinbaseOptions: CoinbaseOptions = {
      apiKeyName: this.config.name,
      privateKey: this.config.privateKey,
    };
    const coinbase = new Coinbase(coinbaseOptions);
    const user = await coinbase.getDefaultUser();

    // Prioritize walletId from Params over Config
    const walletId = params.walletId || this.config.walletId;

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

    // Retrieve the list of balances for the wallet
    let balances = await wallet.listBalances();
    console.log(`Balances: `, balances);

    return {
      data: {
        data: `Balances: ${balances.toString()}`,
      },
    };
  }
}
