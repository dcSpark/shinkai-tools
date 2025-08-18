/* 
Step-by-step explanation:
1. Define TypeScript types CONFIG, INPUTS, and OUTPUT. CONFIG holds the SerpApi API key. INPUTS contains the user query.
2. Build the SerpApi Google Search API URL with the provided query and API key. We assume the engine parameter is "google" and we add q and api_key.
3. Perform a fetch call to the constructed URL and check that the HTTP response is OK.
4. Parse the JSON response.
5. From the response, extract "search_metadata" and "organic_results". Map "organic_results" to a simplified array of objects containing "title", "link", and "snippet". If any field is missing, use an empty string.
6. Return a JSON object that includes the "search_metadata" (as received) and the simplified "search_results" array.
7. The code uses Deno's global fetch API so it is Deno-compatible.
*/

type CONFIG = {
  serpapi_api_key: string;
};

type INPUTS = {
  query: string;
};

type SEARCH_RESULT = {
  title: string;
  link: string;
  snippet: string;
};

type OUTPUT = {
  search_metadata: Record<string, any>;
  search_results: SEARCH_RESULT[];
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  // Construct the URL for the SerpApi Google Search API call.
  const baseUrl = "https://serpapi.com/search.json";
  const params = new URLSearchParams({
    engine: "google",
    q: inputs.query,
    api_key: config.serpapi_api_key
  });
  const url = `${baseUrl}?${params.toString()}`;

  // Fetch the search results from SerpApi
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();

  // Extract search_metadata from response.
  const search_metadata = data.search_metadata || {};

  // Extract and map organic_results to simplified search_results format.
  const organicResults = data.organic_results || [];
  return { search_metadata, search_results: organicResults };
}
