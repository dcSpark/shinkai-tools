import { Tweet, TwttrApi } from "npm:twttrapi-middleware@1.0.9"

export type CONFIG = {
    apiKey: string;
};

export type INPUTS = {
    query: string;
};

export type OUTPUT = {
    data?: Tweet[];
    error?: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { apiKey } = config;
    const { query } = inputs;
    
    try {
      const twttr = new TwttrApi(apiKey);
      const response = await twttr.searchLatest(query);
      if (response.error) throw new Error(`Error fetching followers: ${response.error}`);
      return { data: response };
    } catch(e: any) {
       return { error: e.message };
    }
}
