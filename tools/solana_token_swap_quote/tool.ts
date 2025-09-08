import { Buffer } from "node:buffer";

interface CONFIG { HELIUS_API_KEY: string; }

interface INPUTS { inputSymbol: string; outputSymbol: string; amount: string; }

interface OUTPUT { quote: Quote; inputTokenInfo: TokenInfo; outputTokenInfo: TokenInfo; }

interface TokenData { address: string; name: string; symbol: string; decimals: number; }

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

interface RoutePlan { swapInfo: SwapInfo; percent: number; }

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

// --- helpers ---

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

// precise decimal -> raw integer string
function convertToRawAmount(amount: string, decimals: number): string {
  const s = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid swap amount: ${amount}`);
  const [ints, fracsRaw = ""] = s.split(".");
  const fracs = fracsRaw.slice(0, decimals); // floor, no rounding
  const padded = fracs.padEnd(decimals, "0");
  const rawStr = (ints.replace(/^0+(?=\d)/, "") || "0") + padded;
  // remove leading zeros while keeping at least one zero
  const cleaned = rawStr.replace(/^0+(?=\d)/, "") || "0";
  // ensure it fits BigInt and is non-negative
  const n = BigInt(cleaned);
  if (n <= 0n) throw new Error(`Invalid swap amount: ${amount}`);
  return n.toString();
}

// --- external lookups ---

async function getTokenData(symbol: string): Promise<TokenData> {
  const lowerSymbol = symbol.toLowerCase();
  const url = `https://api.shinkai.com/solana/${lowerSymbol}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch token data for ${symbol}: ${response.statusText}`);
  let data: any = await response.json();
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error(`Token symbol ${symbol} not found.`);
    data = data[0];
  }
  if (!data.address || data.decimals === undefined) throw new Error(`Invalid token data for symbol ${symbol}.`);
  return { address: data.address, name: data.name, symbol: data.symbol, decimals: data.decimals };
}

// Jupiter Swap API (v1 path, Metis v1 routing engine)
async function getPriceQuote(inputMint: string, outputMint: string, amount: string): Promise<Quote> {
  const params = new URLSearchParams({
    inputMint, outputMint, amount,
    slippageBps: "50",
    swapMode: "ExactIn",
    restrictIntermediateTokens: "true" // recommended for route stability
  });
  const pro = `https://api.jup.ag/swap/v1/quote?${params.toString()}`;
  const lite = `https://lite-api.jup.ag/swap/v1/quote?${params.toString()}`;
  const quote = await fetchJsonWithFallback<Quote>([pro, lite]);
  if (!quote?.outAmount) throw new Error(`No valid route found for the swap.`);
  return quote;
}

// Jupiter Token API V2 (maps to your TokenInfo)
async function getTokenInfo(mintAddress: string): Promise<TokenInfo> {
  const pro = `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mintAddress)}`;
  const lite = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mintAddress)}`;
  const results: any[] = await fetchJsonWithFallback<any[]>([pro, lite]);

  if (!Array.isArray(results) || results.length === 0)
    throw new Error(`Failed to get token info for ${mintAddress}: not found`);

  const t = results.find((x) => x?.id === mintAddress) ?? results[0];

  // Map V2 fields to your TokenInfo interface
  const dailyVol =
    typeof t?.stats24h === "object"
      ? Number(t.stats24h?.buyVolume ?? 0) + Number(t.stats24h?.sellVolume ?? 0)
      : undefined;

  const info: TokenInfo = {
    address: t?.id ?? mintAddress,
    name: t?.name ?? "",
    symbol: t?.symbol ?? "",
    decimals: Number(t?.decimals ?? 0),
    logoURI: t?.icon,
    tags: Array.isArray(t?.tags) ? t.tags : undefined,
    daily_volume: Number.isFinite(dailyVol) ? dailyVol : undefined,
    created_at: t?.firstPool?.createdAt
    // other fields (authorities, extensions) are not present in V2 response; leave undefined
  };

  if (!info.address || info.decimals === undefined) {
    throw new Error(`Invalid token info returned for ${mintAddress}`);
  }
  return info;
}

async function getLatestBlockhash(heliusApiKey: string): Promise<string> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  const payload = { jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [] as any[] };
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Helius RPC connection failed: ${response.statusText}`);
  const result = await response.json();
  if (!result?.result?.value?.blockhash) throw new Error("Could not retrieve blockhash from Helius RPC.");
  return result.result.value.blockhash;
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  if (!config?.HELIUS_API_KEY) throw new Error("HELIUS_API_KEY must be provided in config.");
  if (!inputs?.inputSymbol || !inputs?.outputSymbol || !inputs?.amount)
    throw new Error("inputSymbol, outputSymbol, and amount are required inputs.");

  // Sanity: ensure RPC reachable (kept from your original behavior)
  await getLatestBlockhash(config.HELIUS_API_KEY);

  const inputTokenData = await getTokenData(inputs.inputSymbol);
  const outputTokenData = await getTokenData(inputs.outputSymbol);

  const rawAmount = convertToRawAmount(inputs.amount, inputTokenData.decimals);

  const quote = await getPriceQuote(inputTokenData.address, outputTokenData.address, rawAmount);

  const inputTokenInfo = await getTokenInfo(inputTokenData.address);
  const outputTokenInfo = await getTokenInfo(outputTokenData.address);

  return { quote, inputTokenInfo, outputTokenInfo };
}
