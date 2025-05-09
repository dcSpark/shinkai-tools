import { Buffer } from "node:buffer";

interface CONFIG {
  HELIUS_API_KEY: string;
}

interface INPUTS {
  inputSymbol: string;
  outputSymbol: string;
  amount: string;
}

interface OUTPUT {
  quote: Quote;
  inputTokenInfo: TokenInfo;
  outputTokenInfo: TokenInfo;
}

interface TokenData {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface Quote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot?: number;
  timeTaken?: number;
  platformFee?: { amount: string; feeBps: number } | null;
}

interface RoutePlan {
  swapInfo: SwapInfo;
  percent: number;
}

interface SwapInfo {
  ammKey: string;
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
  created_at?: string;
  freeze_authority?: string | null;
  mint_authority?: string | null;
  permanent_delegate?: null;
  minted_at?: null;
  extensions?: unknown;
}

async function getTokenData(symbol: string): Promise<TokenData> {
  const lowerSymbol = symbol.toLowerCase();
  const url = `https://api.shinkai.com/solana/${lowerSymbol}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch token data for ${symbol}: ${response.statusText}`);
  }
  let data = await response.json();
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new Error(`Token symbol ${symbol} not found.`);
    }
    data = data[0];
  }
  if (!data.address || data.decimals === undefined) {
    throw new Error(`Invalid token data for symbol ${symbol}.`);
  }
  return {
    address: data.address,
    name: data.name,
    symbol: data.symbol,
    decimals: data.decimals
  };
}

function convertToRawAmount(amount: string, decimals: number): string {
  const amountFloat = parseFloat(amount);
  if (isNaN(amountFloat) || amountFloat <= 0) {
    throw new Error(`Invalid swap amount: ${amount}`);
  }
  const factor = 10 ** decimals;
  const rawAmount = Math.floor(amountFloat * factor);
  return rawAmount.toString();
}

async function getPriceQuote(inputMint: string, outputMint: string, amount: string): Promise<Quote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: '50',
    swapMode: 'ExactIn'
  });
  const url = `https://api.jup.ag/swap/v1/quote?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get price quote: ${response.statusText}`);
  }
  const quote: Quote = await response.json();
  if (!quote?.outAmount) {
    throw new Error(`No valid route found for the swap.`);
  }
  return quote;
}

async function getTokenInfo(mintAddress: string): Promise<TokenInfo> {
  const url = `https://api.jup.ag/tokens/v1/token/${mintAddress}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get token info for ${mintAddress}: ${response.statusText}`);
  }
  const info: TokenInfo = await response.json();
  return info;
}

async function getLatestBlockhash(heliusApiKey: string): Promise<string> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getLatestBlockhash",
    params: []
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Helius RPC connection failed: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result?.result?.value?.blockhash) {
    throw new Error("Could not retrieve blockhash from Helius RPC.");
  }
  return result.result.value.blockhash;
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  if (!config?.HELIUS_API_KEY) {
    throw new Error("HELIUS_API_KEY must be provided in config.");
  }
  if (!inputs?.inputSymbol || !inputs?.outputSymbol || !inputs?.amount) {
    throw new Error("inputSymbol, outputSymbol, and amount are required inputs.");
  }

  await getLatestBlockhash(config.HELIUS_API_KEY);

  const inputTokenData = await getTokenData(inputs.inputSymbol);
  const outputTokenData = await getTokenData(inputs.outputSymbol);

  const rawAmount = convertToRawAmount(inputs.amount, inputTokenData.decimals);

  const quote = await getPriceQuote(inputTokenData.address, outputTokenData.address, rawAmount);

  const inputTokenInfo = await getTokenInfo(inputTokenData.address);
  const outputTokenInfo = await getTokenInfo(outputTokenData.address);

  return {
    quote,
    inputTokenInfo,
    outputTokenInfo
  };
}