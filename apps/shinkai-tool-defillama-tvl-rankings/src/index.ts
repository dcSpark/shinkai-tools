import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';

import * as playwright from 'playwright';
import * as chromePaths from 'chrome-paths';

type Config = {
  chromePath?: string;
};

type Params = {
  top10?: boolean;
  categoryName: string;
  networkName?: string;
};

type Result = {
  tableCsv: string;
  rowsCount: number;
  columnsCount: number;
};

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-defillama-tvl-rankings',
    name: 'Shinkai: defillama-tvl-rankings',
    description: "Fetches data on DeFi protocols by category (e.g., 'Liquid Staking', 'Lending', 'Bridge', 'Dexes', 'Restaking', 'Liquid Restaking', 'CDP', 'RWA', 'Yield', 'Derivatives', 'Farm', 'Yield Aggregator') and optionally filters by blockchain (e.g., 'Ethereum', 'Solana', 'Arbitrum', 'Base', 'Cardano', 'Near', 'BSC', 'Sui'). Returns protocol details including rank, name, TVL, TVL percentage changes, market cap to TVL ratio, and fees/revenue for the past 24 hours, 7 days, and 30 days.",
    author: 'Shinkai',
    keywords: ['defillama-tvl-rankings', 'shinkai'],
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
        top10: { type: 'boolean', nullable: true },
        categoryName: { type: 'string'},
        networkName: { type: 'string', nullable: true },
      },
      required: [],
    },
    result: {
      type: 'object',
      properties: {
        tableCsv: { type: 'string' },
        rowsCount: { type: 'number' },
        columnsCount: { type: 'number' },
      },
      required: ['tableCsv', 'rowsCount', 'columnsCount'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    return this.withPage(async (page) => {
      const categories = await this.getCategories(page);

      let category = this.findCategoryFromArray(params.categoryName, categories);
      if (!category) {
        throw new Error(`Category ${params.categoryName} not found`);
      }
      
      let networkName = this.findNetworkName(params.networkName);
      if (!this.isValidNetworkName(networkName)) {
        throw new Error(`Network ${params.networkName} not found`);
      }

      await this.goToPage(page, this.getUrl(category, networkName));
      let headers = await this.getHeaders(page);
      let table = await this.getRows(page);

      // Remove the 'Compare' header as it is empty
      const compareIndex = headers.indexOf('Compare');
      if (compareIndex !== -1) {
        headers.splice(compareIndex, 1);
        table = table.map((row) => {
          row.splice(compareIndex, 1);
          return row;
        });
      }

      table = params.top10 ? table.slice(0, 10) : table;

      const tableCsv = [headers, ...table].map((row) => row.join(';')).join('\n');
  
      return {
        data: {
          tableCsv,
          rowsCount: table.length,
          columnsCount: headers.length,
        },
      };
    });
  }

  // a valid network name is one of: Ethereum, Solana, Arbitrum, Base, Cardano, Near, BSC, Sui or undefined
  isValidNetworkName(networkName: string | undefined): boolean {
    return networkName === undefined || ['Ethereum', 'Solana', 'Arbitrum', 'Base', 'Cardano', 'Near', 'BSC', 'Sui'].includes(networkName);
  }

  // normalizes network name to a valid one when possible, otherwise returns undefined
  findNetworkName(networkName: string | undefined): string | undefined {
    if (!networkName) {
      return undefined;
    }

    let candidate = networkName.toLowerCase().trim()
    if (!candidate) {
      return undefined
    }
    
    const mapping: { [key: string]: string } = {
      // eth: 'Ethereum',
      // sol: 'Solana',
      // arb: 'Arbitrum',
      base: 'Base',
      //ada: 'Cardano',
      near: 'Near',
      //bnb: 'BSC',
      sui: 'Sui',
      ethereum: 'Ethereum',
      solana: 'Solana',
      arbitrum: 'Arbitrum',
      cardano: 'Cardano',
      bsc: 'BSC',
    };

    const normalized = mapping[candidate];
    return normalized ? normalized : networkName;
  }

  async getCategories(page: playwright.Page): Promise<string[]> {
    await this.goToPage(page, 'https://defillama.com/categories');
    let table = await this.getRows(page);

    return table
      .map((row) => {
        return row[0];
      })
      .filter((name) => name !== null)
      .map((name) => {
        return name.replace(/^\d+\s*/, '').trim();
      });
  }

  findCategoryFromArray(categoryName: string, categories: string[]): (string | undefined) {
      categoryName = categoryName.trim().toLowerCase();
      return categories.find((category) =>
        category?.toLowerCase().includes(categoryName),
      );
  }

  async withPage<T>(fn: (page: playwright.Page) => Promise<T>): Promise<T> {
    const browser = await playwright['chromium'].launch({
      executablePath: this.config?.chromePath || chromePaths.chrome,
      headless: true,
    });
  
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    });
  
    const page = await context.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close();
      await browser.close();
    }
  }

  private getUrl(categoryName: string, networkName: (string | undefined)): string {
    if (networkName) {
      return `https://defillama.com/protocols/${categoryName}/${networkName}`;
    }

    return `https://defillama.com/protocols/${categoryName}`;
  }

  private async goToPage(page: playwright.Page, url: string): Promise<void>{
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => document.readyState === 'complete');
  }

  async getHeaders(page: playwright.Page): Promise<(string | null)[]> {
    const locator = page.locator('#table-header > div > div:nth-child(3) > span > span', { hasText: 'Name' });
    await locator.waitFor({ state: 'visible' });

    return await page.evaluate(() => {
      const headerDivs = document.querySelectorAll(
        'div[id="table-header"] > div > div',
      );
      return Array.from(headerDivs).map((div) => div.textContent);
    });
  }

  private async getRows(page: playwright.Page): Promise<(string | null)[][]> {
    const rows: Map<string, (string | null)[]> = new Map();

    do {
      const partialRows = await page.$$eval(
        'div[id="table-wrapper"] > div:last-child > div',
        (divs) => {
          return divs.map((div) => {
            const columns = [
              ...(div.querySelectorAll(':scope > div') as any),
            ].map((column) => {
              return column.textContent?.replace(/\d+\s*chains?$/, '').trim() || null;
            });
            return columns;
          });
        },
      );

      partialRows.forEach((row) => {
        const index = row[0];
        if (!index) throw new Error('empty row index');
        rows.set(index, row);
      });

      await page.evaluate(
        ({ partialRows }) => {
          document.scrollingElement?.scrollBy(0, 25 * partialRows.length);
        },
        { partialRows },
      );
      await page.waitForTimeout(50);
    } while (
      await page.evaluate(() => {
        const scrollingElement = document.scrollingElement;
        if (scrollingElement) {
          return (
            scrollingElement.scrollTop + window.innerHeight <
            scrollingElement.scrollHeight
          );
        }
        return false;
      })
    );

    return Array.from(rows.values());
  }

}
