type CONFIG = {
  apiKey: string; // Required SerpAPI api_key
};

type INPUTS = {
  search_query: string;
  sp?: string; // pagination or filter token
  no_cache?: boolean; // optional flag to disable cache
};

type OUTPUT = {
  status: string;
  results?: any;
  error?: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  try {
    if (!inputs.search_query) {
      return { status: "error", error: "Missing required parameter: search_query" };
    }

    const apiKey = config.apiKey;
    if (!apiKey) {
      return { status: "error", error: "Missing SerpAPI api_key" };
    }

    const params = new URLSearchParams();
    params.append("engine", "youtube");
    params.append("search_query", inputs.search_query);
    params.append("api_key", apiKey);
    if (inputs.sp) {
      params.append("sp", inputs.sp);
    }
    if (inputs.no_cache !== undefined) {
      params.append("no_cache", inputs.no_cache ? "true" : "false");
    }
    params.append("output", "json"); // Always json

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      return { status: "error", error: `HTTP error: ${response.status}` };
    }

    const data = await response.json();

    if (data.search_metadata?.status !== "Success") {
      return { status: "error", error: data.error || "Search failed" };
    }

    return { status: "success", results: data };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}