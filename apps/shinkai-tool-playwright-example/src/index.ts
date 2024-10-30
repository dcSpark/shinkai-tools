import * as playwright from 'npm:playwright';
import chromePaths from 'npm:chrome-paths';

type Configurations = {
  chromePath?: string;
};
type Parameters = {
  url: string;
};
type Result = { title: string };

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  const chromePath = configurations?.chromePath || chromePaths.chrome;
  console.log('executing chrome from', chromePath);
  const browser = await playwright['chromium'].launch({
    executablePath: chromePath,
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('navigating to', parameters.url);
    await page.goto(parameters.url);
    const title = await page.title();
    await browser.close();
    return { title };
  } catch (e) {
    console.log('error', e);
    await browser.close();
    throw e;
  }
};

export const definition: ToolDefinition<typeof run> = {
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
