import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import TurndownService = require('turndown');
import axios from 'axios';

type Config = {};
type Params = {
  urls: string[];
};

type Result = { markdowns: string[] };

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-download-pages',
    name: 'Shinkai: Download Pages',
    description: 'Downloads one or more URLs and converts their HTML content to Markdown',
    author: 'Shinkai',
    keywords: ['HTML to Markdown', 'web page downloader', 'content conversion', 'URL to Markdown'],
    configurations: {
      type: 'object',
      properties: {},
      required: [],
    },
    parameters: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' } },
      },
      required: ['urls'],
    },
    result: {
      type: 'object',
      properties: {
        markdowns: { type: 'array', items: { type: 'string' } },
      },
      required: ['markdowns'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    try {
      const responses = await axios.all(params.urls.map(url => axios.get(url)));
      const turndownService = new TurndownService();
      const markdowns = responses.map(response => turndownService.turndown(response.data));
      return Promise.resolve({ data: { markdowns } });
    } catch (error) {
      return Promise.resolve({ data: { markdowns: [] } });
    }
  }
}
