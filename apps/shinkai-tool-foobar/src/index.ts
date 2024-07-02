import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';

type Config = {};
type Params = {
  message: string;
};
type Result = { message: string };
export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-foobar',
    name: 'Shinkai: foobar',
    description: 'New foobar tool from template',
    author: 'Shinkai',
    keywords: ['foobar', 'shinkai'],
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
    const message = `hello world foobar`;
    console.log(message);
    return Promise.resolve({ data: { message } });
  }
}
