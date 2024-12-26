import { run } from './tool.ts';
import { expect } from 'jsr:@std/expect';

Deno.test({
  name: 'echo',
  sanitizeResources: false,
  sanitizeOps: false,
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
