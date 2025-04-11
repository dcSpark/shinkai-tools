import { User, TwttrApi } from "npm:twttrapi-middleware@1.0.8"

export type CONFIG = {
    apiKey: string;
};

export type INPUTS = {
    query: string;
};

export type OUTPUT = {
    data?: User[];
    error?: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { apiKey } = config;
    const { query } = inputs;
    
    try {
      const twttr = new TwttrApi(apiKey);
      const response = await twttr.searchUsers(query);
      if (response.error) throw new Error(`Error searching users: ${response.error}`);
      return { data: response };
    } catch(e: any) {
       return { error: e.message };
    }
}
