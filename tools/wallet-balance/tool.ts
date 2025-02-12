import { 
  createPublicClient, 
  createWalletClient,
  http,
  formatEther,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hex,
  erc20Abi
} from 'npm:viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'npm:viem/accounts'

import * as chains from 'npm:viem/chains'

type CONFIG = {
  privateKey: `0x${string}`;
}

type INPUTS = {
  rpcURL: string;
  chain: keyof typeof chains;
  contractAddress: `0x${string}`;
}

type OUTPUT = {
  ethBalance: string;
  tokenBalance: string | undefined;
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

  async getETHBalance(): Promise<string> {
    const balance = await this.publicClient.getBalance({ address: this.walletAddress });
    return formatEther(balance);
  }

  async getTokenBalance(contractAddress: Address): Promise<string> {
    const [balance, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [this.walletAddress]
      }),
      this.publicClient.readContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: 'decimals'
      })
    ]);

    return (balance / 10n ** BigInt(decimals)).toString();
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
    const { chain, rpcURL, contractAddress } = inputs;

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

    const ethBalance = await walletManager.getETHBalance();
    
    let tokenBalance: string | undefined;
    if (contractAddress) {
      tokenBalance = await walletManager.getTokenBalance(contractAddress);
    }
    
    return { ethBalance, tokenBalance };
}
