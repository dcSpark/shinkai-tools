import axios from 'npm:axios';

type Configurations = {
  project?: string;
  language?: string;
};

type Parameters = {
  query: string;
  limit?: number;
};

type Result = {
  titles: Array<{
    title: string;
    description: string;
    url: string;
  }>;
};

export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (
  config: C,
  inputs: I
) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters
): Promise<Result> => {
  const project = configurations?.project || 'wikipedia';
  const language = configurations?.language || 'en';
  const limit = params.limit || 10;
  
  const api_url = `https://api.wikimedia.org/core/v1/${project}/${language}/search/title`;
  
  const response = await axios.get(api_url, {
    params: {
      q: params.query,
      limit: Math.min(Math.max(1, limit), 50)
    }
  });

  return {
    titles: response.data.pages.map((page: any) => ({
      title: page.title,
      description: page.description || '',
      url: `https://${language}.${project}.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
    }))
  };
};
