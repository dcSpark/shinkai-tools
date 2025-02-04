import axios from 'npm:axios';

type Configurations = {
  project?: string;
  language?: string;
};

type Parameters = {
  title: string;
};

type Result = {
  content: {
    title: string;
    html: string;
    url: string;
    lastModified: string;
    language: string;
  };
};

export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (
  config: C,
  inputs: I
) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters
): Promise<Result> => {
  try {
    const project = configurations?.project || 'wikipedia';
    const language = configurations?.language || 'en';
    
    // Using the REST v1 API endpoint for page content
    const api_url = `https://${language}.${project}.org/api/rest_v1/page/html/${encodeURIComponent(params.title)}`;
    
    const response = await axios.get(api_url, {
      headers: {
        'User-Agent': 'ShinkaiWikimediaPageContent/1.0',
        'Accept': 'text/html; charset=utf-8',
        'Api-User-Agent': 'ShinkaiWikimediaPageContent/1.0 (https://github.com/dcSpark/shinkai-tools)'
      }
    });

    if (!response.data) {
      throw new Error('No data received from Wikimedia API');
    }

    return {
      content: {
        title: params.title,
        html: response.data,
        url: `https://${language}.${project}.org/wiki/${encodeURIComponent(params.title.replace(/ /g, '_'))}`,
        lastModified: response.headers['last-modified'] || '',
        language: language
      }
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error(`Page '${params.title}' not found`);
      }
      throw new Error(`Failed to fetch page content: ${error.response?.data?.detail || error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};
