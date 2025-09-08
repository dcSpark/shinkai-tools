import { Keypair, VersionedTransaction } from "npm:@solana/web3.js";
import bs58 from "npm:bs58";
import { Buffer } from "node:buffer";

// Type definitions for CONFIG, INPUTS and OUTPUT
interface CONFIG {
  PRIVATE_KEY: string;
  TAKER_ADDRESS: string;
}

interface INPUTS {
  SWAP_INPUT_TOKEN: string;
  SWAP_OUTPUT_TOKEN: string;
  SWAP_AMOUNT: number;
}

interface OrderResponse {
  swapType: string;
  requestId: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
  transaction: string | null;
}

interface ExecuteResponse {
  status: string;
  signature: string;
  slot?: string;
  code: number;
  inputAmountResult: string;
  outputAmountResult: string;
  swapEvents?: unknown[];
}

interface OUTPUT {
  orderResponse: OrderResponse;
  executeResponse: ExecuteResponse;
}

// Helper function to fetch JSON with fallback endpoints
async function fetchJsonWithFallback<T>(urls: string[]): Promise<T> {
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) return (await res.json()) as T;
      // try the next base if 4xx/5xx
      lastErr = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Helper function to fetch JSON with POST request and fallback endpoints
async function fetchPostJsonWithFallback<T>(urls: string[], body: object): Promise<T> {
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) return (await res.json()) as T;
      // try the next base if 4xx/5xx
      lastErr = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Helper function to fetch token address and decimals from Shinkai API
async function getTokenAddress(symbol: string): Promise<{ address: string; decimals: number }> {
  const lowerSymbol = symbol.toLowerCase();
  const url = `https://api.shinkai.com/solana/${lowerSymbol}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch token address for ${symbol}: ${response.statusText}`);
  }
  let data = await response.json() as { address: string; decimals: number } | { address: string; decimals: number }[];
  if (Array.isArray(data)) {
    data = data[0];
  }
  const { address, decimals } = data;
  if (!address || decimals === undefined) {
    throw new Error(`Token symbol ${symbol} not found or missing decimals`);
  }
  return { address, decimals };
}

// Function to create an order and execute the swap transaction
async function orderAndExecute(
  inputMintSymbol: string,
  outputMintSymbol: string,
  amount: number,
  taker: string,
  privateKey: string
): Promise<{ orderResponse: OrderResponse; executeResponse: ExecuteResponse }> {
  const inputToken = await getTokenAddress(inputMintSymbol);
  const outputToken = await getTokenAddress(outputMintSymbol);

  const rawAmount = (amount * Math.pow(10, inputToken.decimals)).toString();

  const orderParams = new URLSearchParams({
    inputMint: inputToken.address,
    outputMint: outputToken.address,
    amount: rawAmount,
    taker: taker
  });

  const orderUrls = [
    `https://api.jup.ag/ultra/v1/order?${orderParams.toString()}`,
    `https://lite-api.jup.ag/ultra/v1/order?${orderParams.toString()}`
  ];

  const orderResponse: OrderResponse = await fetchJsonWithFallback(orderUrls);
  if (!orderResponse.transaction) {
    throw new Error(`Failed processing order: ${orderResponse.errorMessage}`);
  }

  const secretKey = bs58.decode(privateKey);
  const wallet = Keypair.fromSecretKey(secretKey);
  if (wallet.publicKey.toBase58() !== taker) {
    throw new Error(`Wallet public key (${wallet.publicKey.toBase58()}) does not match taker (${taker})`);
  }

  const txnBytes = Buffer.from(orderResponse.transaction, "base64");
  const transaction = VersionedTransaction.deserialize(txnBytes);

  transaction.sign([wallet]);
  const signedTxnBase64 = Buffer.from(transaction.serialize()).toString("base64");

  const executeUrls = [
    "https://api.jup.ag/ultra/v1/execute",
    "https://lite-api.jup.ag/ultra/v1/execute"
  ];

  const executePayload = {
    signedTransaction: signedTxnBase64,
    requestId: orderResponse.requestId
  };

  const executeResponse: ExecuteResponse = await fetchPostJsonWithFallback(executeUrls, executePayload);
  return { orderResponse, executeResponse };
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  if (!config.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY must be provided in config");
  }
  if (!config.TAKER_ADDRESS) {
    throw new Error("TAKER_ADDRESS must be provided in config");
  }
  if (!inputs.SWAP_INPUT_TOKEN) {
    throw new Error("SWAP_INPUT_TOKEN must be provided in inputs");
  }
  if (!inputs.SWAP_OUTPUT_TOKEN) {
    throw new Error("SWAP_OUTPUT_TOKEN must be provided in inputs");
  }
  if (!inputs.SWAP_AMOUNT || inputs.SWAP_AMOUNT <= 0) {
    throw new Error("SWAP_AMOUNT must be a positive number");
  }

  const { orderResponse, executeResponse } = await orderAndExecute(
    inputs.SWAP_INPUT_TOKEN,
    inputs.SWAP_OUTPUT_TOKEN,
    inputs.SWAP_AMOUNT,
    config.TAKER_ADDRESS,
    config.PRIVATE_KEY
  );

  return { orderResponse, executeResponse };
}
