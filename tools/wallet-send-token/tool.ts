
import { 
  createPublicClient, 
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hex,
  type TransactionReceipt,
  erc20Abi
} from 'npm:viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'npm:viem/accounts'

import * as chains from 'npm:viem/chains'

interface CONFIG {
  privateKey: `0x${string}`;
}

type INPUTS = {
  rpcURL: string;
  chain: keyof typeof chains;
  contractAddress: `0x${string}`;
  toAddress: `0x${string}`;
  amount: number;
}

type OUTPUT = {
  receipt: {
    transactionHash: `0x${string}`;
    status: string;
    gasUsed: bigint;
    gasPrice: bigint;
    value?: bigint;
    from: `0x${string}`;
    to: string;
  };
}

export class WalletManager {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: PrivateKeyAccount;
  private chain: Chain;
  private walletAddress: Address;
  
  constructor(privateKey: Hex, chain: Chain, rpcURL: string | undefined) {
    this.account = privateKeyToAccount(privateKey);
    this.walletAddress = this.account.address;
    this.chain = chain;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcURL)
    });
    this.walletClient = createWalletClient({
      chain: this.chain,
      transport: http(this.publicClient.transport.url), // Use same RPC URL
      account: this.account
    });
  }

  private async getTokenValue(contractAddress: Address, amount: string | number | bigint): Promise<bigint> {
    const decimals = await this.publicClient.readContract({
      address: contractAddress,
      abi: erc20Abi,
      functionName: 'decimals'
    });
    return BigInt(amount) * (10n ** BigInt(decimals));
  }
  
  async sendTokens(
    contractAddress: Address,
    toAddress: Address,
    amount: string,
  ): Promise<TransactionReceipt> {
    const value = await this.getTokenValue(contractAddress, amount);
    const { request } = await this.publicClient.simulateContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress, value],
        account: this.account
    });
    const hash = await this.walletClient.writeContract(request);
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }
}

export async function run(
  config: CONFIG,
  inputs: INPUTS
): Promise<OUTPUT> {
    const { privateKey } = config;
    if (!privateKey) {
      throw new Error('Private key is required in config');
    }
    const { chain, rpcURL, contractAddress, toAddress, amount } = inputs;
    if (!contractAddress || !toAddress || !amount) {
      throw new Error('Token address, to address, and amount are required in inputs');
    }

    let selectedChain: Chain = chains.baseSepolia;
    
    if (chain) {
      selectedChain = chains[chain as keyof typeof chains] as Chain;
      if (!selectedChain) {
        throw new Error(`Chain ${chain as string} not found`);
      }
    }
    const walletManager = new WalletManager(
      privateKey, selectedChain, rpcURL
    );

    let receipt = await walletManager.sendTokens(contractAddress, toAddress, String(amount));
    
    // Convert bigint to string, next step needs be a serialiable Json.
    receipt = JSON.parse(JSON.stringify(receipt, (_, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value
    , 2));
    
    return { 
      receipt: {
        transactionHash: receipt.transactionHash,
        status: receipt.status,
        gasUsed: receipt.gasUsed,
        gasPrice: receipt.effectiveGasPrice,
        from: receipt.from,
        to: receipt.to ?? '',
      },
      amount: amount,
      chain: selectedChain.name,
    };
};

