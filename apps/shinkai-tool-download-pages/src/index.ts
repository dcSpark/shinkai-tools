import TurndownService from 'npm:turndown@7.2.0';
import axios from 'npm:axios@1.7.7';

type Configurations = {};
type Parameters = {
  url: string;
};

type Result = { markdown: string };

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

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-download-pages',
  name: 'Shinkai: Download Pages',
  description:
    'Downloads a URL and converts its HTML content to Markdown',
  author: 'Shinkai',
  keywords: [
    'HTML to Markdown',
    'web page downloader',
    'content conversion',
    'URL to Markdown',
  ],
  configurations: {
    type: 'object',
    properties: {},
    required: [],
  },
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
    },
    required: ['url'],
  },
  result: {
    type: 'object',
    properties: {
      markdown: { type: 'string' },
    },
    required: ['markdown'],
  },
};
