import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import TurndownService from 'turndown';
import axios from 'axios';

type Config = {};
type Params = {
  url: string;
};

type Result = { markdown: string };


export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-download-page',
    name: 'Shinkai: Download Page',
    description: 'Downloads a URL and converts its HTML content to Markdown',
    author: 'Shinkai',
    keywords: ['download page', 'url to markdown', 'shinkai'],
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

  async run(params: Params): Promise<RunResult<Result>> {
    await process.nextTick(() => { });
    const response = await axios.get(params.url);
    const html = response.data;
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(html);
    return Promise.resolve({ data: { markdown } });
  }
}
