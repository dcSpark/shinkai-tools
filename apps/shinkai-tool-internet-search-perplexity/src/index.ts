import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
const TurndownService = require('turndown');
const { chromium } = require('playwright-extra');
const fs = require('fs');
const path = require('path');

const stealth = require('puppeteer-extra-plugin-stealth');

chromium.use(stealth());

type Config = {};
type Params = {
  query: string;
};

type Result = {
  query: string;
  results: string;
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-perplexity-search',
    name: 'Shinkai: Perplexity Search',
    description:
      'Performs a search using Perplexity and returns the results',
    author: 'Shinkai',
    keywords: ['perplexity', 'search', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {},
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
        query: { type: 'string' },
        results: { type: 'string' },
      },
      required: ['query', 'results'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    console.log('Launching browser...');
    const browser = await chromium.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Path to local Chrome
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 } // Set the window size here
    });
    const page = await context.newPage();

    console.log('Navigating to Perplexity\'s website...');
    await page.goto('https://www.perplexity.ai/');

    console.log('Waiting for the page to load...');
    await page.waitForTimeout(2000); // Wait for 3 seconds to ensure the page is fully loaded

    console.log('Taking a screenshot...');
    console.log('__dirname:', __dirname); // Log the __dirname
    const screenshotPath = path.join(__dirname, 'screenshot.png');
    try {
      await page.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved to ${screenshotPath}`);
    } catch (error) {
      console.error('Error taking screenshot:', error);
    }

    console.log('Filling textarea with query:', params.query);
    await page.fill('textarea', params.query);

    console.log('Clicking the button with the specified SVG...');
    await page.click('button:has(svg[data-icon="arrow-right"])');

    console.log('Waiting for the button with the specified SVG to be visible...');
    await page.waitForSelector('button:has(svg[data-icon="arrow-right"])');

    console.log('Waiting for results to load...');
    await page.waitForTimeout(2000); // Wait for 3 seconds to ensure the page is fully loaded
    // await page.waitForSelector('.result');

    console.log('Taking a screenshot...');
    console.log('__dirname:', __dirname); // Log the __dirname
    const screenshotPath2 = path.join(__dirname, 'screenshot2.png');
    try {
      await page.screenshot({ path: screenshotPath2 });
      console.log(`Screenshot saved to ${screenshotPath2}`);
    } catch (error) {
      console.error('Error taking screenshot:', error);
    }

    console.log('Extracting HTML content...');
    const htmlContent = await page.evaluate(() => {
      const resultElements = document.querySelectorAll('div[dir="auto"]');
      return Array.from(resultElements).map(element => element.innerHTML).join('\n\n');
    });

    console.log('Closing browser...');
    await browser.close();

    console.log('Converting HTML to Markdown...');
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(htmlContent);

    const result: Result = {
      query: params.query,
      results: markdown,
    };

    console.log('Returning result:', result);
    return Promise.resolve({ data: result });
  }
}
