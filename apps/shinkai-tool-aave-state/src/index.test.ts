import { run } from './index.ts';
import { expect } from 'jsr:@std/expect';

Deno.test({
  name: 'echo',
  sanitizeResources: false,
  sanitizeOps: false,
  ignore: Deno.env.get('CI') === 'true' || Deno.build.os === 'windows',
  fn: async () => {
    const result = await run(
      {
        chromePath: Deno.env.get('CHROME_PATH'),
      },
      {},
    );
    expect(result).toBeDefined();
  },
});
