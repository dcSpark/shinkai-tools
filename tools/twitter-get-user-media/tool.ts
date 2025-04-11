import { Media, TwttrApi } from "npm:twttrapi-middleware@1.0.8"

export type CONFIG = {
    apiKey: string;
};

export type INPUTS = {
    username: string;
};

export type OUTPUT = {
    data?: Media[];
    error?: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { apiKey } = config;
    const { username } = inputs;
    
    try {
      const twttr = new TwttrApi(apiKey);
      const response = await twttr.getUserMedia(username);
      if (response.error) throw new Error(`Error fetching tweet: ${response.error}`);
      return { data: response };
    } catch(e: any) {
       return { error: e.message };
    }
}
