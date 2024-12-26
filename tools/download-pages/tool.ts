import TurndownService from 'npm:turndown@7.2.0';
import axios from 'npm:axios@1.7.7';

type Configurations = {};
type Parameters = {
  urls: string[];
};

type Result = { markdowns: string[] };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  _configurations: Configurations,
  parameters: Parameters,
): Promise<Result> => {
  try {
    const responses = await axios.all(
      parameters.urls.map((url) => axios.get(url)),
    );
    const turndownService = new TurndownService();
    const markdowns = responses.map((response: any) =>
      turndownService.turndown(response.data),
    );
    return Promise.resolve({ markdowns });
  } catch (error) {
    console.log('error', error);
    return Promise.resolve({ markdowns: [] });
  }
};
