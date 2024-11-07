import process from 'node:process';
import { run } from './index.ts';
import { expect } from 'jsr:@std/expect';

Deno.test({
  name: 'echo',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const result = await run(
      {
        chromePath: process.env?.CHROME_PATH,
      },
      {},
    );
    expect(result).toBeDefined();
  },
});
