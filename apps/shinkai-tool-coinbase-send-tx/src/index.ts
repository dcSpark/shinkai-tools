import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { Coinbase, CoinbaseOptions, Transfer } from '@coinbase/coinbase-sdk';

type Config = {
  name: string;
  privateKey: string;
  walletId: string;
  seed?: string;
  useServerSigner?: string;
};
type Params = {
  recipient_address: string;
  assetId: string;
  amount: string;
};
type Result = {
  transactionHash: string;
  transactionLink: string;
  status: string;
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-coinbase-send-tx',
    name: 'Shinkai: Coinbase Transaction Sender',
    description:
      'Tool for restoring a Coinbase wallet and sending a transaction',
    author: 'Shinkai',
    keywords: ['coinbase', 'transaction', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        privateKey: { type: 'string' },
        walletId: { type: 'string', nullable: true },
        seed: { type: 'string', nullable: true },
        useServerSigner: { type: 'string', default: 'false', nullable: true },
      },
      required: ['name', 'privateKey'],
    },
    parameters: {
      type: 'object',
      properties: {
        recipient_address: { type: 'string' },
        assetId: { type: 'string' },
        amount: { type: 'string' },
      },
      required: ['recipient_address', 'assetId', 'amount'],
    },
    result: {
      type: 'object',
      properties: {
        transactionHash: { type: 'string' },
        transactionLink: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['transactionHash', 'transactionLink', 'status'],
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
    console.log(`Coinbase configured: `, coinbase);
    const user = await coinbase.getDefaultUser();
    console.log(`User: `, user);

    // Check if seed exists or useServerSigner is true, but not both
    if (!this.config.seed && this.config.useServerSigner !== 'true') {
      throw new Error(
        'Either seed must be provided or useServerSigner must be true',
      );
    }
    if (this.config.seed && this.config.useServerSigner === 'true') {
      throw new Error(
        'Both seed and useServerSigner cannot be true at the same time',
      );
    }

    // Prioritize walletId from Params over Config
    const walletId = this.config.walletId;
    let wallet;

    if (this.config.useServerSigner === 'true') {
      // Use getWallet if useServerSigner is true
      if (!walletId) {
        throw new Error(
          'walletId must be provided when useServerSigner is true',
        );
      }
      wallet = await user.getWallet(walletId);
      console.log(`Wallet retrieved using server signer: `, wallet.toString());
    } else {
      if (walletId) {
        // Retrieve existing Wallet using walletId
        wallet = await user.importWallet({
          walletId,
          // it's not going to be empty but to quiet the type error
          seed: this.config.seed || '',
        });
        console.log(`Wallet retrieved: `, wallet.toString());
      } else {
        // Create a new Wallet for the User
        wallet = await user.createWallet({
          networkId: Coinbase.networks.BaseSepolia,
        });
        console.log(`Wallet successfully created: `, wallet.toString());
      }
    }

    // Retrieve the list of balances for the wallet
    let balances = await wallet.listBalances();
    console.log(`Balances: `, balances);

    // If no balances, call the faucet and then list balances again
    if (balances.size === 0) {
      const faucetTransaction = await wallet.faucet();
      console.log(
        `Faucet transaction completed successfully: `,
        faucetTransaction.toString(),
      );

      // Retrieve the list of balances again
      balances = await wallet.listBalances();
      console.log(`Balances after faucet: `, balances);
    }

    // Convert amount from string to number
    const amount = parseFloat(params.amount);
    if (isNaN(amount)) {
      throw new Error('Invalid amount provided');
    }

    // Convert assetId to have only the first letter capitalized
    const formattedAssetId = params.assetId.toLowerCase();

    // Create and send the transfer
    let transfer: Transfer;
    try {
      transfer = await wallet.createTransfer({
        amount,
        assetId: Coinbase.toAssetId(formattedAssetId),
        destination: params.recipient_address,
        // gasless: true,
      });
      console.log(`Transfer successfully completed: `, transfer.toString());
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error during transfer:', error);
        throw new Error(`Transfer failed: ${error.message}`);
      } else {
        console.error('Unknown error during transfer:', error);
        throw new Error('Transfer failed due to an unknown error');
      }
    }

    return {
      data: {
        transactionHash: transfer.getTransactionHash() || '',
        transactionLink: transfer.getTransactionLink() || '',
        status: transfer.getStatus() || '',
      },
    };
  }
}
