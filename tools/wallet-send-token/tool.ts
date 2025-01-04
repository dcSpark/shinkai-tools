import { 
  createPublicClient, 
  createWalletClient,
  http,
  formatEther,
  encodeFunctionData,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hex,
  type TransactionReceipt,
  erc20Abi
} from 'npm:viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'npm:viem/accounts'

import { arbitrumSepolia, arbitrumNova, base, baseSepolia } from 'npm:viem/chains'

interface WalletConfig {
  rpcUrl: string;
  chain: Chain;
  privateKey: Hex;
}

const chainsDict = {
  ARBITRUM_SEPOLIA : arbitrumSepolia,
  ARBITRUM_NOVA : arbitrumNova,
  BASE : base,
  BASE_SEPOLIA : baseSepolia,
}

interface CONFIG {
  chain: keyof typeof chainsDict;
  privateKey: `0x${string}`;
  rpcURL: string;
}

type INPUTS = {
  to_address: `0x${string}`;
  tokenAddress: `0x${string}`;
  amount: string | number | bigint;
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
  private account: PrivateKeyAccount;
  private chain: Chain;
  private address: Address;

  constructor({ rpcUrl, chain, privateKey }: WalletConfig) {
    this.account = privateKeyToAccount(privateKey);
    this.address = this.account.address;
    this.chain = chain;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });
  }

  private createWalletClient(): WalletClient {
    return createWalletClient({
      chain: this.chain,
      transport: http(this.publicClient.transport.url), // Use same RPC URL
      account: this.account
    });
  }

  async getETHBalance(address: Address=this.address): Promise<string> {
    const balance = await this.publicClient.getBalance({ address });
    return formatEther(balance);
  }

  async getTokenBalance(tokenAddress: Address, walletAddress: Address=this.address): Promise<string> {
    const [balance, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress]
      }),
      this.publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals'
      })
    ]);

    return (balance / 10n ** BigInt(decimals)).toString();
  }

  private async getTokenValue(tokenAddress: Address, amount: string | number | bigint): Promise<bigint> {
    const decimals = await this.publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals'
    });
    return BigInt(amount) * (10n ** BigInt(decimals));
  }

  async estimateGas(
    tokenAddress: Address, 
    toAddress: Address, 
    amount: string | number | bigint
  ): Promise<bigint> {
    const value = await this.getTokenValue(tokenAddress, amount);
    return await this.publicClient.estimateContractGas({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [toAddress, value],
      account: this.account.address
    });
  }
  async sendTokens(
    tokenAddress: Address,
    toAddress: Address,
    amount: string | number | bigint
  ): Promise<TransactionReceipt> {
    const value = await this.getTokenValue(tokenAddress, amount);
    const walletClient = this.createWalletClient();
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [toAddress, value]
    });
    const gasEstimate = await this.estimateGas(tokenAddress, toAddress, amount);
    /*const request = await walletClient.prepareTransactionRequest({
      to: tokenAddress,
      account: this.account.address,
      abi: erc20Abi,
      chain: this.chain,
      gas: gasEstimate,
      data,
    });*/
    const tx = await walletClient.signTransaction({
      to: tokenAddress,
      account: this.account.address,
      abi: erc20Abi,
      chain: this.chain,
      gas: gasEstimate,
      data,
    });
    const hash = await this.publicClient.sendRawTransaction({
      serializedTransaction: tx
    });
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }
}

const TOKENSEND_ERROR = 'TOKENSEND_ERROR';

export async function run(
  config: CONFIG,
  inputs: INPUTS
): Promise<OUTPUT> {
  try {
    const { tokenAddress, to_address: toAddress, amount } = inputs;
    if (!tokenAddress || !toAddress || !amount) {
      throw new Error('Token address, to address, and amount are required in inputs');
    }
    const walletManager = new WalletManager({
      rpcUrl: config.rpcURL,
      chain: chainsDict[config.chain],
      privateKey: config.privateKey
    });
    const receipt = await walletManager.sendTokens(tokenAddress, toAddress, amount);
    return { receipt: {
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      gasUsed: receipt.gasUsed,
      gasPrice: receipt.effectiveGasPrice,
      from: receipt.from,
      to: receipt.to ?? '',
    } };
  } catch (error) {
      throw new Error(TOKENSEND_ERROR, { cause: error });
  }
}
