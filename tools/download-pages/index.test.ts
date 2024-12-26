import { run } from './index.ts';
import { expect } from 'jsr:@std/expect';

Deno.test({
  name: 'download markdown python wikipedia',
  permissions: { net: true, env: true },
  fn: async () => {
    const result = await run(
      {},
      { urls: ['https://en.wikipedia.org/wiki/Python_programming_language'] },
    );
    console.log('markdowns', result.markdowns);
    expect(
      result.markdowns.find((markdown) =>
        markdown.includes('dynamically type'),
      ),
    ).toBeDefined();

    expect(
      result.markdowns.find((markdown) => markdown.includes('#History')),
    ).toBeDefined();
  },
});
