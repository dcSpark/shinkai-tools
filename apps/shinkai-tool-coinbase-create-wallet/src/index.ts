import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { Coinbase, CoinbaseOptions } from '@coinbase/coinbase-sdk';

type Config = {
  name: string;
  privateKey: string;
  useServerSigner?: string;
};
type Params = {}; // Params type is now empty
type Result = {
  walletId?: string;
  seed?: string;
  address?: string;
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-coinbase-create-wallet',
    name: 'Shinkai: Coinbase Wallet Creator',
    description: 'Tool for creating a Coinbase wallet',
    author: 'Shinkai',
    keywords: ['coinbase', 'wallet', 'creator', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        privateKey: { type: 'string' },
        useServerSigner: { type: 'string', default: 'false', nullable: true },
      },
      required: ['name', 'privateKey'],
    },
    parameters: {
      type: 'object',
      properties: {},
      required: [], // No required parameters
    },
    result: {
      type: 'object',
      properties: {
        walletId: { type: 'string', nullable: true },
        seed: { type: 'string', nullable: true },
        address: { type: 'string', nullable: true },
      },
      required: [],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const coinbaseOptions: CoinbaseOptions = {
      apiKeyName: this.config.name,
      privateKey: this.config.privateKey,
      useServerSigner: this.config.useServerSigner === 'true',
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
    if (!this.config.useServerSigner) {
      exportedWallet = await wallet.export();
    }

    const address = await wallet.getDefaultAddress();

    return {
      data: {
        ...exportedWallet,
        walletId: wallet.getId(),
        address: address?.getId(),
      },
    };
  }
}
