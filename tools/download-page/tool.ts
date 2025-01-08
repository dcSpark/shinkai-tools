import TurndownService from 'npm:turndown@7.2.0';
import axios from 'npm:axios@1.7.7';

type Configurations = {};
type Parameters = {
  url: string;
};

type Result = { markdown: string };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  _configurations: Configurations,
  parameters: Parameters,
): Promise<Result> => {
  try {
    const response = await axios.get(parameters.url);
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(response.data);
    return Promise.resolve({ markdown });
  } catch (error) {
    console.log('error', error);
    return Promise.resolve({ markdown: '' });
  }
};
