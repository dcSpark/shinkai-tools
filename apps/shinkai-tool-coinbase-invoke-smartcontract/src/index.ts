import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import {
  Coinbase,
  CoinbaseOptions,
  Transfer,
  Wallet,
} from '@coinbase/coinbase-sdk';

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

// From basescan
const contractABI = [
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'string', name: 'metadata', type: 'string' },
    ],
    name: 'transferWithMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-coinbase-invoke-smartcontract',
    name: 'Shinkai: Coinbase Smart Contract Invoker',
    description: 'Tool for invoking a Coinbase smart contract',
    author: 'Shinkai',
    keywords: ['coinbase', 'smart contract', 'shinkai'],
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
      wallet = await Wallet.fetch(walletId);
      console.log(`Wallet retrieved using server signer: `, wallet.toString());
    } else {
      throw new Error('useServerSigner must be true for now');
    }

    // Convert amount from string to number
    const amount = parseFloat(params.amount);
    if (isNaN(amount)) {
      throw new Error('Invalid amount provided');
    }

    let addresses = await wallet.listAddresses();
    console.log(`Addresses: `, addresses);

    // Get the default address
    let defaultAddress = await wallet.getDefaultAddress();
    console.log(`Default Address: ${defaultAddress}`);

    // Interact with the smart contract
    const contractAddress = '0xa5bD7651D197df11d2a0DE1311718AE7DD11b9Ff';

    // Invoke the 'transferWithMetadata' function
    try {
      const transferInvocation = await wallet.invokeContract({
        contractAddress,
        abi: contractABI,
        method: 'transferWithMetadata',
        args: {
          token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          recipient: params.recipient_address,
          amount: amount,
          metadata: 'kai:001-AAA',
        },
      });
      await transferInvocation.wait();
      console.log(`transferWithMetadata function invoked successfully`);
    } catch (error) {
      console.error(`Error invoking transferWithMetadata function: ${error}`);
    }

    return {
      data: {
        transactionHash: '',
        transactionLink: '',
        status: 'success',
      },
    };
  }
}
