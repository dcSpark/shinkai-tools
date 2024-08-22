import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import * as playwright from 'playwright';
import * as chromePaths from 'chrome-paths';
import { createWalletClient, http, parseEther } from 'viem';

// Remove later. It's for debugging.
import * as fs from 'fs';
import * as path from 'path';

type Config = {
  chromePath?: string;
};
type Params = {};
type Result = {
  assetsToSupply: { asset: string; apy: string }[];
  assetsToBorrow: { asset: string; apy: string }[];
};

// Extend the Window interface to include ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-get-loan-state',
    name: 'Shinkai: Current Aave Loan State',
    description:
      'Tool for requesting a loan on Aave, including selecting assets to supply and borrow with their APYs',
    author: 'Shinkai',
    keywords: ['aave', 'market', 'extractor', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {
        chromePath: { type: 'string', nullable: true },
      },
      required: [],
    },
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    result: {
      type: 'object',
      properties: {
        assetsToSupply: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              asset: { type: 'string' },
              apy: { type: 'string' },
            },
            required: ['asset', 'apy'],
          },
        },
        assetsToBorrow: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              asset: { type: 'string' },
              apy: { type: 'string' },
            },
            required: ['asset', 'apy'],
          },
        },
      },
      required: ['assetsToSupply', 'assetsToBorrow'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const browser = await playwright['chromium'].launch({
      executablePath: this.config?.chromePath || chromePaths.chrome,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }, // Set viewport size
    });

    const page = await context.newPage();
    // await page.goto(params.url);
    await page.goto(
      'https://staging.aave.com/?marketName=proto_arbitrum_sepolia_v3',
    );

    const viemPath = path.join(__dirname, 'bundled-resources/shinkai-viem.js');
    if (!fs.existsSync(viemPath)) {
      throw new Error(`Viem bundle not found at path: ${viemPath}`);
    }

    // Read the content of viem-bundle.js
    const viemScriptContent = fs.readFileSync(viemPath, 'utf8');
    console.log('Viem script loaded');

    await page.evaluate((scriptContent) => {
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      console.log('Viem script injected');
    }, viemScriptContent);

    // Click the "Opt-out" button
    // Wait for the "Opt-out" button to appear and click it
    await page.waitForSelector('#rcc-decline-button > p');
    await page.click('#rcc-decline-button > p');

    // Click the wallet button
    await page.waitForSelector('#wallet-button');
    await page.click('#wallet-button');

    // Click the "Browser wallet" button
    const browserWalletButton = page.locator(
      'body > div:nth-child(20) > div[class*="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1"] > div[class*="MuiBox-root"] > button:nth-child(2)',
    );

    await browserWalletButton.waitFor({ state: 'visible' });
    console.log('Browser wallet button is visible');
    await browserWalletButton.click();

    // Wait for 120 seconds
    await page.waitForTimeout(3000);
    console.log('Waited for 3 seconds');

    // Take a screenshot and save it to ./tmp/
    const screenshotPath = path.join(__dirname, 'tmp', 'screenshot.png');
    await page.screenshot({ path: screenshotPath });

    await browser.close();
    return Promise.resolve({
      data: { assetsToSupply: [], assetsToBorrow: [] },
    });
  }
}
