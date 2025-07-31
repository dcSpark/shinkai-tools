type CONFIG = {
  api_key: string;
};
type INPUTS = {
  query: string;
  max_GIF_number?: number;
  offset?: number;
  rating?: "g" | "pg" | "pg-13" | "r";
  language?: string;
};
type GifMinimal = {
  id: string;
  title: string;
  url: string;
  gif_url: string;
  embed_url: string;
};
type OUTPUT = {
  data?: GifMinimal[];
  error?: {
    status: number;
    message: string;
  };
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { api_key } = config;
  let { query, max_GIF_number, offset, rating, language } = inputs;

  // Validate API key
  if (!api_key || typeof api_key !== "string") {
    return {
      error: { status: 400, message: "Missing or invalid api_key in config" },
    };
  }

  // Validate query
  if (!query || typeof query !== "string") {
    return {
      error: { status: 400, message: "Missing or invalid search query (query)" },
    };
  }
  if (query.length > 50) {
    return {
      error: { status: 414, message: "Search query exceeds 50 characters" },
    };
  }

  // Set defaults and constraints
  if (typeof max_GIF_number !== "number" || isNaN(max_GIF_number)) max_GIF_number = 10;
  if (max_GIF_number > 50) max_GIF_number = 50;
  if (max_GIF_number < 1) max_GIF_number = 1;
  if (typeof offset !== "number" || isNaN(offset)) offset = 0;
  if (typeof language !== "string" || !language) language = "en";
  const allowedRatings = ["g", "pg", "pg-13", "r"];
  if (rating && !allowedRatings.includes(rating)) {
    return {
      error: {
        status: 400,
        message: "Invalid rating. Allowed: g, pg, pg-13, r"
      }
    };
  }

  // Build query params
  const params: Record<string, string> = {
    api_key,
    q: query,
    max_GIF_number: max_GIF_number.toString(),
    offset: offset.toString(),
    language,
  };
  if (rating) params["rating"] = rating;

  // Construct URL
  const baseUrl = `https://api.giphy.com/v1/gifs/search`;
  const searchParams = new URLSearchParams(params);
  const url = `${baseUrl}?${searchParams.toString()}`;

  // Fetch from GIPHY API
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    return {
      error: {
        status: 500,
        message: "Failed to fetch from GIPHY: " + (err instanceof Error ? err.message : String(err)),
      },
    };
  }

  // Parse response
  let json: any;
  try {
    json = await response.json();
  } catch (err) {
    return {
      error: {
        status: response.status,
        message: "Failed to parse response from GIPHY",
      },
    };
  }

  // Handle HTTP errors or GIPHY API errors
  if (!response.ok) {
    return {
      error: {
        status: response.status,
        message: json?.meta?.msg || response.statusText || "GIPHY API error",
      },
    };
  }

  // Minimal GIF fields
  const minimalGifs: GifMinimal[] = Array.isArray(json?.data)
    ? json.data.map((gif: any) => ({
        id: gif.id || "",
        title: gif.title || "",
        url: gif.url || "",
        gif_url: gif.images?.original?.url || "",
        embed_url: gif.embed_url || ""
      }))
    : [];

  return {
    data: minimalGifs
  };
}