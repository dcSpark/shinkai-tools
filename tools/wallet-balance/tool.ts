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
  address: `0x${string}`;
}

type OUTPUT = {
  ethBalance: string;
  tokenBalance: string;
}

export class WalletManager {
  private publicClient: PublicClient;
  private account: PrivateKeyAccount;
  private chain: Chain;
  private walletAddress: Address;

  constructor({ rpcUrl, chain, privateKey }: WalletConfig) {
    this.account = privateKeyToAccount(privateKey);
    this.walletAddress = this.account.address;
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

  async getETHBalance(walletAddress: Address=this.walletAddress): Promise<string> {
    const balance = await this.publicClient.getBalance({ address: walletAddress });
    return formatEther(balance);
  }

  async getTokenBalance(contractAddress: Address, walletAddress: Address=this.walletAddress): Promise<string> {
    const [balance, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress]
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

const ETHBALANCE_ERROR = 'ETHBALANCE_ERROR';

export async function run(
  config: CONFIG,
  inputs: INPUTS
): Promise<OUTPUT> {

    const { address } = inputs;
    const contractAddress = address;
    if (! contractAddress) {
      throw new Error('Address is required in inputs');
    }

    const walletManager = new WalletManager({
      rpcUrl: config.rpcURL,
      chain: chainsDict[config.chain],
      privateKey: config.privateKey
    });
    const ethBalance = await walletManager.getETHBalance();
    const tokenBalance = await walletManager.getTokenBalance(contractAddress);
    return { ethBalance, tokenBalance };

}
