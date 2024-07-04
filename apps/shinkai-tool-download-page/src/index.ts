import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import TurndownService from 'turndown';

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
    const response = await fetch(params.url);
    const html = await response.text();
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(html);
    return Promise.resolve({ data: { markdown } });
  }
}
