import { expect } from 'jsr:@std/expect/expect';
import { definition, run } from './index.ts';
import process from 'node:process';

Deno.test('exists definition', () => {
  expect(definition).toBeInstanceOf(Object);
});

Deno.test({
  name: 'run',
  // Perplexity web scrapping is not working in CI (need to figure out why)
  ignore: Deno.env.get('CI') === 'true' || Deno.build.os === 'windows',
  fn: async () => {
    const run_result = await run(
      {
        chromePath: process.env?.CHROME_PATH,
      },
      {
        query: 'What is the meaning of life?',
      },
    );
    expect(run_result.response).toEqual(expect.any(String));
  },
});
