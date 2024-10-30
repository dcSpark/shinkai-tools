import process from 'node:process';
import { run } from './index.ts';
import { expect } from 'jsr:@std/expect';

Deno.test('echo', async () => {
  const result = await run(
    {
      chromePath: process.env?.CHROME_PATH,
    },
    {
      inputValue: '0.005',
      assetSymbol: 'ETH',
    },
  );
  expect(result.amountProcessed).toBeDefined();
});
