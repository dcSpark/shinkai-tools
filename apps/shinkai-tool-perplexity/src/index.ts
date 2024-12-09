import chromePaths from 'npm:chrome-paths@1.0.1';
import TurndownService from 'npm:turndown@7.2.0';
// import puppeteer from 'npm:rebrowser-puppeteer@23.10.1';
import { addExtra } from 'npm:puppeteer-extra@3.3.6';
import rebrowserPuppeteer from 'npm:rebrowser-puppeteer@23.10.1';
import StealthPlugin from 'npm:puppeteer-extra-plugin-stealth@2.11.2';

type Configurations = {
  chromePath?: string;
};
type Parameters = {
  query: string;
};
type Result = { response: string };

const puppeteer = addExtra(rebrowserPuppeteer);
const pluginStealth = StealthPlugin();

pluginStealth.enabledEvasions.delete('chrome.loadTimes');
pluginStealth.enabledEvasions.delete('chrome.runtime');

puppeteer.use(pluginStealth);

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  params,
): Promise<Result> => {
  const chromePath =
    configurations?.chromePath ||
    Deno.env.get('CHROME_PATH') ||
    chromePaths.chrome ||
    chromePaths.chromium;
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();

  console.log("Navigating to Perplexity's website...");
  await page.goto('https://www.perplexity.ai/');

  console.log('Waiting for the page to load...');
  await page.waitForNetworkIdle({ timeout: 2500 });

  console.log('Filling textarea with query:', params.query);
  await page.type('textarea', params.query);

  try {
    console.log('trying to click app popup');
    await page.click('button:has(svg[data-icon="xmark"])');
  } catch (_) {
    console.log('unable to find the x button to close the popup');
  }

  console.log('Clicking the button with the specified SVG...');
  await page.click('button:has(svg[data-icon="arrow-right"])');

  console.log('Waiting for the button with the specified SVG to be visible...');
  await page.waitForSelector('button:has(svg[data-icon="arrow-right"])');

  console.log('Waiting for results to load...');
  await page.waitForSelector('text=Related');

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
