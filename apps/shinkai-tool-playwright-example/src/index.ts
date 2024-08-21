import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import * as playwright from 'playwright';
import * as chromePaths from 'chrome-paths';

type Config = {
  chromePath?: string;
};
type Params = {
  url: string;
};
type Result = { title: string };
export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-playwright-example',
    name: 'Shinkai: playwright-example',
    description: 'New playwright-example tool from template',
    author: 'Shinkai',
    keywords: ['playwright-example', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {
        chromePath: { type: 'string', nullable: true },
      },
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
        title: { type: 'string' },
      },
      required: ['title'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const browser = await playwright['chromium'].launch({
      executablePath: this.config?.chromePath || chromePaths.chrome,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(params.url);
    const title = await page.title();
    await browser.close();
    return Promise.resolve({ data: { title } });
  }
}
