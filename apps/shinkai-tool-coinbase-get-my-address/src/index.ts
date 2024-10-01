import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { Coinbase, CoinbaseOptions, Wallet } from '@coinbase/coinbase-sdk';

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
  address: string;
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-coinbase-get-my-address',
    name: 'Shinkai: Coinbase My Address Getter',
    description: 'Tool for getting the default address of a Coinbase wallet',
    author: 'Shinkai',
    keywords: ['coinbase', 'address', 'shinkai'],
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
        address: { type: 'string' },
      },
      required: ['address'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const coinbaseOptions: CoinbaseOptions = {
      apiKeyName: this.config.name,
      privateKey: this.config.privateKey,
      useServerSigner: this.config.useServerSigner === 'true',
    };

    try {
      new Coinbase(coinbaseOptions);
    } catch (error) {
      console.error('Error initializing Coinbase:', error);
      throw error;
    }

    // Prioritize walletId from Params over Config
    const walletId = params.walletId || this.config.walletId;

    // Throw an error if walletId is not defined
    if (!walletId) {
      throw new Error('walletId must be defined in either params or config');
    }

    const wallet = await Wallet.fetch(walletId);
    console.log(`Wallet retrieved: `, wallet.toString());

    let addresses = await wallet.listAddresses();
    console.log(`Addresses: `, addresses);

    // Retrieve the list of balances for the wallet
    let address = await wallet.getDefaultAddress();
    console.log(`Default Address: `, address);

    // // Create another address in the wallet.
    // let address2 = await wallet.createAddress();
    // console.log(`Address: ${address2}`);

    // Retrieve the list of balances for the wallet
    let address3 = await wallet.getDefaultAddress();
    console.log(`Default Address: `, address3);

    return {
      data: {
        address: address?.getId() || '',
      },
    };
  }
}
