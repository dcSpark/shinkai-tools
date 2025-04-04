import TwttrApi, { User } from "npm:twttrapi-middleware"

export type CONFIG = {
    apiKey: string;
};

export type INPUTS = {
    username: string;
};

export type OUTPUT = {
    data?: User[];
    error?: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { apiKey } = config;
    const { username } = inputs;
    
    try {
      const twttr = new TwttrApi.default(apiKey);
      const response = await twttr.getUserFollowers(username);
      if (response.error) throw new Error(`Error fetching followers: ${response.error}`);
      return { data: response };
    } catch(e: any) {
       return { error: e.message };
    }
}