// main.ts
import "https://deno.land/std@0.190.0/dotenv/load.ts"; // Use the latest version if possible

// Now you can access your variables:
console.log("API_KEY:", Deno.env.get("API_KEY"));
console.log("PORT:", Deno.env.get("PORT"));
console.log("X_SHINKAI_LLM_PROVIDER:", Deno.env.get("X_SHINKAI_LLM_PROVIDER"));
console.log("SHINKAI_NODE_LOCATION:", Deno.env.get("SHINKAI_NODE_LOCATION"));
console.log("X_SHINKAI_APP_ID:", Deno.env.get("X_SHINKAI_APP_ID"));

import { run, SearchEngine } from "./tool.ts";


const config = {
  searchEngineApiKey: "API_KEY",
  searchEngine: "DUCKDUCKGO" as SearchEngine,
  maxSources: 3,
}

const input = {
  question: "What are the applications of DAGs in blockchain or cryptocurrencies?",
}

const result = await run(config, input);

console.log(result);