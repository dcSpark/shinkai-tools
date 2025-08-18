/* 
Step-by-step Thinking Process:
1. Define the types for CONFIG, INPUTS, and OUTPUT. 
   - CONFIG includes the SerpApi API key.
   - INPUTS consist of the user-provided query and an optional geographic coordinate ("ll").
2. Construct the proper SerpApi endpoint URL. The base URL is "https://serpapi.com/search.json". The required parameters are:
   - engine=google_maps
   - type=search
   - q (the search query, URL-encoded)
   - api_key (provided in the config)
   - Optionally, if provided, add ll (the geographic coordinate).
3. Use the global fetch API (native in Deno) to query the URL.
4. Check for fetch or non-success response; if there is an error or response status is not 200, throw an error.
5. Parse the JSON response. The JSON contains a property "local_results" which is an array of business entries.
6. Iterate over the local_results array and extract details for each business:
   - position
   - title
   - place_id
   - rating (if available)
   - address (if available)
   - phone (if available)
   - website (if available)
7. Return the formatted list under the key "results" as a JSON object.
8. Ensure that the code uses Deno built-in functions and is written in a single TypeScript file that matches our run function signature.
*/

type CONFIG = {
    api_key: string;
};

type INPUTS = {
    query: string;
    ll?: string;
};

type BusinessResult = {
    position: number;
    title: string;
    place_id: string;
    rating?: number;
    address?: string;
    phone?: string;
    website?: string;
};

type OUTPUT = {
    results: BusinessResult[];
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Validate required fields.
    if (!config.api_key) {
        throw new Error("Missing SerpApi API key in config.");
    }
    if (!inputs.query) {
        throw new Error("Missing query in inputs.");
    }

    // Construct query parameters.
    const urlParams = new URLSearchParams({
        engine: "google_maps",
        type: "search",
        q: inputs.query,
        api_key: config.api_key,
        hl: "en",
        google_domain: "google.com"
    });

    // Append ll if provided.
    if (inputs.ll) {
        urlParams.append("ll", inputs.ll);
    }

    const url = `https://serpapi.com/search.json?${urlParams.toString()}`;

    // Make fetch request using Deno's global fetch.
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error fetching results: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    // Extract local_results. If not present, return an empty list.
    const localResults = Array.isArray(data.local_results) ? data.local_results : [];

    // Map each local result to a formatted business object.
    const results: BusinessResult[] = localResults.map((item: any) => ({
        position: item.position,
        title: item.title,
        place_id: item.place_id,
        rating: item.rating,
        address: item.address,
        phone: item.phone,
        website: item.website
    }));

    return { results };
}
