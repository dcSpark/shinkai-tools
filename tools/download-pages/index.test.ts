import { run } from './tool.ts';
import { expect } from 'jsr:@std/expect';

Deno.test({
  name: 'download markdown python wikipedia',
  permissions: { net: true, env: true },
  fn: async () => {
    const result = await run(
      {},
      { url: 'https://en.wikipedia.org/wiki/Python_programming_language' },
    );
    console.log('markdown', result.markdown);
    expect(result.markdown.includes('dynamically type')).toBe(true);
    expect(result.markdown.includes('#History')).toBe(true);
  },
});
