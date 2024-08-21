import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import * as playwright from 'playwright';
import * as chromePaths from 'chrome-paths';

type Config = {
  chromePath?: string;
};
type Params = {
  all?: boolean;
};
type Result = { tableCsv: string; rowsCount: number; columnsCount: number };

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-defillama-lending-tvl-rankings',
    name: 'Shinkai: defillama-lending-tvl-rankings',
    description: 'New defillama-lending-tvl-rankings tool from template',
    author: 'Shinkai',
    keywords: ['defillama-lending-tvl-rankings', 'shinkai'],
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
        all: { type: 'boolean', nullable: true },
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
    const DEFILLAMA_URL = 'https://defillama.com/protocols/lending';
    const browser = await playwright['chromium'].launch({
      executablePath: this.config?.chromePath || chromePaths.chrome,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(DEFILLAMA_URL);
    await page.waitForLoadState('networkidle');
    const headers: (string | null)[] = await page.$$eval(
      'div[id="table-header"] > div > div',
      (divs) =>
        divs.map((div) => {
          return div.textContent;
        }),
    );
    console.log('headers', headers);

    const rows: Map<string, (string | null)[]> = new Map();
    do {
      const partialRows = await page.$$eval(
        'div[id="table-wrapper"] > div:last-child > div',
        (divs) => {
          return divs.map((div) => {
            const columns = [
              ...(div.querySelectorAll(':scope > div') as any),
            ].map((column) => {
              return column.textContent;
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
          document.scrollingElement?.scrollBy(0, 50 * (partialRows.length - 1));
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
    let table = Array.from(rows.values());
    table = params.all ? table : table.slice(0, 10);
    const tableCsv = [headers, ...table].map((row) => row.join(',')).join('\n');
    await browser.close();
    return Promise.resolve({
      data: { tableCsv, rowsCount: table.length, columnsCount: headers.length },
    });
  }
}
