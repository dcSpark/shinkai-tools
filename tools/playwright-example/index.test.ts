import { expect } from 'jsr:@std/expect/expect';
import { run } from './tool.ts';
import process from 'node:process';

Deno.test({
  name: 'get shinkai page title',
  permissions: {
    read: true,
    env: true,
    write: true,
    run: true,
  },
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const result = await run(
      {
        chromePath: Deno.env.get('CHROME_PATH'),
      },
      { url: 'https://shinkai.com' },
    );
    console.log('tool result', result);
    expect(result.title).toBe(
      'Shinkai | Fully Local AI (Models, Files and Agents)',
    );
  },
});
