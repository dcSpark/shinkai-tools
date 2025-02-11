
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
  toAddress: `0x${string}`;
  contractAddress: `0x${string}`;
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
  private walletAddress: Address;
  private chain: Chain;
  private account: PrivateKeyAccount;

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
      transport: http(), // Use same RPC URL
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

  private async getTokenValue(contractAddress: Address, amount: string | number | bigint): Promise<bigint> {
    const decimals = await this.publicClient.readContract({
      address: contractAddress,
      abi: erc20Abi,
      functionName: 'decimals'
    });
    return BigInt(amount) * (10n ** BigInt(decimals));
  }

  async estimateGas(
    contractAddress: Address, 
    toAddress: Address, 
    amount: string | number | bigint
  ): Promise<bigint> {
    const value = await this.getTokenValue(contractAddress, amount);
    return await this.publicClient.estimateContractGas({
      address: contractAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [toAddress, value],
      account: this.account.address
    });
  }
  async sendTokens(
    contractAddress: Address,
    toAddress: Address,
    amount: bigint
  ): Promise<TransactionReceipt> {
    const value = await this.getTokenValue(contractAddress, amount);
    const walletClient = this.createWalletClient();
    const { request } = await this.publicClient.simulateContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress, value],
        account: this.account
    });
    console.log("Simulation");
    console.log(JSON.stringify(request, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value
        , 2));
    const hash = await walletClient.writeContract(request);
    
    /*{
      to: contractAddress,
      account: this.walletAddress,
      abi: erc20Abi,
      chain: this.chain,
      gas: gasEstimate,
      data,
    });*/
   // const hash = await this.publicClient.sendRawTransaction({
    //  serializedTransaction: tx
    //});
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }
}

export async function run(
  config: CONFIG,
  inputs: INPUTS
): Promise<OUTPUT> {
    const { contractAddress, toAddress, amount } = inputs;
    if (!contractAddress || !toAddress || !amount) {
      throw new Error('Token address, to address, and amount are required in inputs');
    }
    const walletManager = new WalletManager({
      rpcUrl: config.rpcURL,
      chain: chainsDict[config.chain],
      privateKey: config.privateKey
    });
    const b_amount = BigInt(amount);
    let receipt = await walletManager.sendTokens(contractAddress, toAddress, b_amount);
    
    receipt = JSON.parse(JSON.stringify(receipt, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value // return everything else unchanged
        , 2));
    
    return { receipt: {
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      gasUsed: receipt.gasUsed,
      gasPrice: receipt.effectiveGasPrice,
      from: receipt.from,
      to: receipt.to ?? '',
    } };
};

