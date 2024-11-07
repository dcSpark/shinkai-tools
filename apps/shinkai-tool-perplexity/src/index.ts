import * as playwright from 'npm:playwright@1.48.2';
import chromePaths from 'npm:chrome-paths@1.0.1';
import TurndownService from 'npm:turndown@7.2.0';
import { defineConfig } from 'npm:playwright@1.48.2/test';

type Configurations = {
  chromePath?: string;
};
type Parameters = {
  query: string;
};
type Result = { response: string };

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  params,
): Promise<Result> => {
  defineConfig({
    use: {
      actionTimeout: 60 * 1000,
      navigationTimeout: 60 * 1000,
    },
  });
  const browser = await playwright['chromium'].launch({
    executablePath: configurations?.chromePath || chromePaths.chrome,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }, // Set viewport size
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36', // Set Mac user agent
  });
  const page = await context.newPage();

  console.log("Navigating to Perplexity's website...");
  await page.goto('https://www.perplexity.ai/');

  console.log('Waiting for the page to load...');
  await page.waitForTimeout(2500);

  console.log('Filling textarea with query:', params.query);
  await page.fill('textarea', params.query);

  console.log('Clicking the button with the specified SVG...');
  await page.click('button:has(svg[data-icon="arrow-right"])');

  console.log('Waiting for the button with the specified SVG to be visible...');
  await page.waitForSelector('button:has(svg[data-icon="arrow-right"])');

  console.log('Waiting for results to load...');
  await page.waitForSelector('div:has-text("Related")');

  console.log('Extracting HTML content...');
  const htmlContent = await page.evaluate(() => {
    const resultElements = document.querySelectorAll('div[dir="auto"]');
    return Array.from(resultElements)
      .map((element) => element.innerHTML)
      .join('\n\n');
  });

  console.log('Closing browser...');
  await browser.close();

  console.log('Converting HTML to Markdown...');
  const turndownService = new TurndownService();
  turndownService.addRule('preserveLinks', {
    filter: 'a',
    replacement: function (_content: string, node: Element) {
      const element = node as Element;
      const href = element.getAttribute('href');
      return `[${href}](${href})`;
    },
  });
  const markdown = turndownService.turndown(htmlContent);

  const result: Result = {
    response: markdown,
  };

  console.log('Returning result:', result);
  return Promise.resolve({ ...result });
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-perplexity',
  name: 'Shinkai: Perplexity',
  description: 'Searches the internet using Perplexity',
  author: 'Shinkai',
  keywords: ['perplexity', 'shinkai'],
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
      query: { type: 'string' },
    },
    required: ['query'],
  },
  result: {
    type: 'object',
    properties: {
      response: { type: 'string' },
    },
    required: ['response'],
  },
};
