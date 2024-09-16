import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import * as path from 'path';
import * as playwright from 'playwright';
import * as chromePaths from 'chrome-paths';

import { viemScriptContent } from './bundled-resources/shinkai-viem';

const xxlTimeout = 50 * 60 * 1000;
const sTimeout = 5 * 1000;
const xsTimeout = 2 * 1000;

type SuppliedAsset = {
  name: string;
  balance: number;
  balanceInUSD: number;
};

type BorrowedAsset = {
  name: string;
  debt: number;
};

type ToSupplyAsset = {
  name: string;
  balance: number;
};

type ToBorrowAsset = {
  name: string;
  available: number;
};

type Config = {
  chromePath?: string;
};

type Params = {
  secretKey: string;
};

type Result = { 
  suppliedAssets: SuppliedAsset[];
  borrowedAssets: BorrowedAsset[];
  toSupplyAssets: ToSupplyAsset[];
  toBorrowAssets: ToBorrowAsset[];
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-aave-dashboard',
    name: 'Shinkai: aave-dashboard',
    description: 'New aave-dashboard tool from template',
    author: 'Shinkai',
    keywords: ['aave-dashboard', 'shinkai'],
    configurations: {
      type: 'object',
      properties: {
        chromePath: {
          type: 'string',
          nullable: true,
        },
      },
      required: [],
    },
    parameters: {
      type: 'object',
      properties: {
        secretKey: { type: 'string' },
      },
      required: ['secretKey'],
    },
    result: {
      type: 'object',
      properties: {
        suppliedAssets: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: {
              name: { type: 'string' },
              balance: { type: 'number' },
              balanceInUSD: { type: 'number' },
            },
            required: ['name', 'balance', 'balanceInUSD'] 
          }
        },
        borrowedAssets: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: {
              name: { type: 'string' },
              debt: { type: 'number' },
            },
          required: ['name', 'debt'] 
          }
        },
        toSupplyAssets: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: {
              name: { type: 'string' },
              balance: { type: 'number' },
            },
          required: ['name', 'balance'] 
          }
        },
        toBorrowAssets: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: {
              name: { type: 'string' },
              available: { type: 'number' },
            },
          required: ['name', 'available'] 
          }
        },
      },
      required: ['suppliedAssets', 'borrowedAssets', 'toSupplyAssets', 'toBorrowAssets'],
    },
  };

  private async hasSupplies(page: playwright.Page, timeout: number = xsTimeout): Promise<boolean> {
    var s = 'main > div.MuiBox-root > div > div.MuiBox-root > div > div.MuiBox-root > div.MuiPaper-root.MuiPaper-elevation.MuiPaper-rounded.MuiPaper-elevation1 > div.MuiBox-root > div > p'
    const nothingToBorrow = await page.locator(s, { hasText: 'Nothing supplied yet' }) 

    let isThereSomethingToBorrow = true;

    await nothingToBorrow.waitFor({ state: 'visible', timeout: timeout }).then(() => {
      isThereSomethingToBorrow = false;
    }).catch((error) => {
      isThereSomethingToBorrow = error instanceof playwright.errors.TimeoutError;
    });

    return isThereSomethingToBorrow;
  }

  private async getYourSupplies(page: playwright.Page): Promise<SuppliedAsset[]> {
    const hasSupplies = await this.hasSupplies(page, sTimeout);
    if (!hasSupplies) {
      return [];
    }

    await page.waitForFunction(() => {
      return (Array.from(document.querySelectorAll("div[data-cy^=dashboardSuppliedListItem]"))).length > 0;
    }, { timeout: sTimeout });

    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("div[data-cy^=dashboardSuppliedListItem]"))
      console.log(10, rows)

      return rows.map((row) => {
        const name = row.querySelector('div[class*="MuiBox-root"]')?.textContent || '';
        const balance = row.querySelector('div[class*="MuiBox-root"] > p:nth-child(1)')?.textContent || '0';
        let balanceInUSD = row.querySelector('div[class*="MuiBox-root"] > p:nth-child(2)')?.textContent || '0';

        balanceInUSD = balanceInUSD.replace('$', '').trim();

        return {
          name,
          balance: Number(balance),
          balanceInUSD: Number(balanceInUSD),
        };
      })  
    });
  }

  private async hasBorrows(page: playwright.Page, timeout: number = xsTimeout): Promise<boolean> {
    var s = 'main > div.MuiBox-root > div > div.MuiBox-root > div > div.MuiBox-root > div.MuiPaper-root.MuiPaper-elevation.MuiPaper-rounded.MuiPaper-elevation1 > div.MuiBox-root > div > p'
    const nothingToBorrow = await page.locator(s, { hasText: 'Nothing borrowed yet' }) 

    let isThereSomethingToBorrow = true;

    await nothingToBorrow.waitFor({ state: 'visible', timeout: timeout }).then(() => {
      isThereSomethingToBorrow = false;
    }).catch((error) => {
      isThereSomethingToBorrow = error instanceof playwright.errors.TimeoutError;
    });

    return isThereSomethingToBorrow;
  }

  private async getYourBorrows(page: playwright.Page): Promise<BorrowedAsset[]> {
    let isThereSomethingToBorrow = await this.hasBorrows(page, xsTimeout);
    console.log('isThereSomethingToBorrow', isThereSomethingToBorrow)

    if (!isThereSomethingToBorrow) {
      return [];
    }
    // dashboardBorrowedListItem_USDC_Variable

    await page.waitForFunction(() => {
      return (Array.from(document.querySelectorAll("div[data-cy^=dashboardBorrowedListItem]"))).length > 0;
    }, { timeout: sTimeout });

    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("div[data-cy^=dashboardBorrowedListItem]"))

      return rows.map((row) => {
        const name = row.querySelector('div[class*="MuiBox-root"]')?.textContent || '';
        const debt = row.querySelector('div[class*="MuiBox-root"] > p:nth-child(1)')?.textContent || '0';

        return {
          name,
          debt: Number(debt),
        };
      })  
    });
  }

  private async getToSupplyAssets(page: playwright.Page): Promise<ToSupplyAsset[]> {
    await page.waitForFunction(() => {
      return (Array.from(document.querySelectorAll("div[data-cy^=dashboardSupplyListItem]"))).length > 0;
    }, { timeout: sTimeout });

    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("div[data-cy^=dashboardSupplyListItem]"))
      console.log(10, rows)

      return rows.map((row) => {
        const name = row.querySelector('div[class*="MuiBox-root"]')?.textContent || '';
        const balance = row.querySelector('div[class*="MuiBox-root"] > p:nth-child(1)')?.textContent || '0';

        return {
          name,
          balance: Number(balance),
        };
      })  
    });
  }

  private async getToBorrowAssets(page: playwright.Page): Promise<ToBorrowAsset[]> {
    await page.waitForFunction(() => {
      return (Array.from(document.querySelectorAll("div[data-cy^=dashboardBorrowListItem]"))).length > 0;
    }, { timeout: sTimeout });

    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("div[data-cy^=dashboardBorrowListItem]"))
      console.log(10, rows)

      return rows.map((row) => {
        const name = row.querySelector('div[class*="MuiBox-root"]')?.textContent || '';
        const available = row.querySelector('div[class*="MuiBox-root"] > p:nth-child(1)')?.textContent || '0';

        return {
          name,
          available: Number(available),
        };
      })  
    });
  }

  async run(params: Params): Promise<RunResult<Result>> {
    const browser = await playwright['chromium'].launch({
      executablePath: this.config?.chromePath || chromePaths.chrome,
      headless: false,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }, // Set viewport size
    });

    const page = await context.newPage();
    await page.goto('https://staging.aave.com/?marketName=proto_base_sepolia_v3');

    await page.evaluate((scriptContent) => {
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      console.log('Viem script injected');
    }, Buffer.from(viemScriptContent, 'base64').toString('utf-8'));

    await page.evaluate((secretKey) => {
      (window as any).initViemProvider(secretKey);
    }, params.secretKey);

    // Click the "Opt-out" button
    // Wait for the "Opt-out" button to appear and click it
    console.log('10 Waiting for selector');
    await page.waitForSelector('#rcc-decline-button > p', { timeout: xxlTimeout });
    await page.click('#rcc-decline-button > p');

    // Click the wallet button
    console.log('20 Waiting for selector');
    await page.waitForSelector('#wallet-button', { timeout: xxlTimeout });
    await page.click('#wallet-button');

    // Click the "Browser wallet" button
    const browserWalletButton = page.locator(
      'body > div:nth-child(20) > div[class*="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1"] > div[class*="MuiBox-root"] > button:nth-child(2)',
    );

    await browserWalletButton.waitFor({ state: 'visible' });
    console.log('Browser wallet button is visible');
    await browserWalletButton.click();

    const suppliedAssets = await this.getYourSupplies(page);
    const borrowedAssets = await this.getYourBorrows(page);
    const toSupplyAssets = await this.getToSupplyAssets(page);
    const toBorrowAssets = await this.getToBorrowAssets(page);

    return Promise.resolve({ data: { suppliedAssets, borrowedAssets, toSupplyAssets, toBorrowAssets } });
  }
}
