import { Keypair } from 'npm:@solana/web3.js';
import bs58 from 'npm:bs58@5.0.0';

type CONFIG = {
  HELIUS_API_KEY: string;
  SOLANA_PRIVATE_KEY: string;
};

type INPUTS = Record<string, never>;

type Token = {
  symbol: string;
  balance: number;
  mintAddress: string;
};

type OUTPUT = {
  tokens: Token[];
};

type HeliusResponse = {
  nativeBalance?: {
    lamports: number;
  };
  items?: Array<{
    token_info?: {
      symbol: string;
      balance: string;
      decimals: string;
      associated_token_address: string;
    };
  }>;
  error?: {
    message: string;
  };
};

async function getWalletTokens(apiKey: string, walletAddress: string): Promise<HeliusResponse> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const payload = {
    jsonrpc: "2.0",
    id: "id" + new Date().getTime(),
    method: "getAssetsByOwner",
    params: {
      ownerAddress: walletAddress,
      displayOptions: {
        showFungible: true,
        showNativeBalance: true,
      }
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Failed to fetch tokens: " + response.statusText);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`API Error: ${data.error.message}`);
  }
  return data.result;
}

export async function run(config: CONFIG, _inputs: INPUTS): Promise<OUTPUT> {
  if (!config.HELIUS_API_KEY) {
    throw new Error("HELIUS_API_KEY must be provided in the config");
  }
  if (!config.SOLANA_PRIVATE_KEY) {
    throw new Error("SOLANA_PRIVATE_KEY must be provided in the config");
  }

  const secretKey = bs58.decode(config.SOLANA_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(secretKey);
  const walletAddress = wallet.publicKey.toString();

  const result = await getWalletTokens(config.HELIUS_API_KEY, walletAddress);

  const tokens: Token[] = [];

  if (result.nativeBalance && typeof result.nativeBalance.lamports === "number") {
    const lamports: number = result.nativeBalance.lamports;
    const solBalance = lamports / 1e9;
    if (solBalance > 0) {
      tokens.push({
        symbol: "SOL",
        balance: solBalance,
        mintAddress: "So11111111111111111111111111111111111111112"
      });
    }
  }

  if (result.items && Array.isArray(result.items)) {
    for (const item of result.items) {
      if (item.token_info) {
        const tokenInfo = item.token_info;
        if (tokenInfo.symbol && tokenInfo.balance != null && tokenInfo.decimals != null && tokenInfo.associated_token_address) {
          const computedBalance = Number(tokenInfo.balance) / Math.pow(10, Number(tokenInfo.decimals));
          tokens.push({
            symbol: tokenInfo.symbol,
            balance: computedBalance,
            mintAddress: tokenInfo.associated_token_address
          });
        }
      }
    }
  }

  return { tokens };
}