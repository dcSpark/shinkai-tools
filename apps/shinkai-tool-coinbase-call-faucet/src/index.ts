import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { Coinbase, CoinbaseOptions } from '@coinbase/coinbase-sdk';

type Config = {
  name: string;
  privateKey: string;
  walletId: string;
};
type Params = {};
type Result = {
  data: string;
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-coinbase-call-faucet',
    name: 'Shinkai: Coinbase Faucet Caller',
    description: 'Tool for calling a faucet on Coinbase',
    author: 'Shinkai',
    keywords: ['coinbase', 'faucet', 'shinkai'],
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
      properties: {},
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
    console.log(`Coinbase configured: `, coinbase);
    const user = await coinbase.getDefaultUser();
    console.log(`User: `, user);

    // Use walletId from Config only
    const walletId = this.config.walletId;

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
      data: {
        data: `Faucet transaction completed successfully: ${faucetTransaction.toString()} for wallet: ${wallet.getDefaultAddress()}`,
      },
    };
  }
}
