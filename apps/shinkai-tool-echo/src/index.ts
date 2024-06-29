import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';

type Config = {};
type Params = {
  message: string;
};
type Result = { message: string };
export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-echo',
    name: 'Shinkai: Echo',
    description: 'Echoes the input message',
    author: 'Shinkai',
    keywords: ['echo', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {},
      required: [],
    },
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    result: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    console.log('run echo from js', 4);
    return Promise.resolve({ data: { message: `echoing: ${params.message}` } });
  }
}
