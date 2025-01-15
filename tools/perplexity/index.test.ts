import { expect } from 'jsr:@std/expect/expect';
import { run } from './tool.ts';


Deno.test({
  name: 'run',
  // Perplexity web scrapping is not working in CI (need to figure out why)
  ignore: Deno.env.get('CI') === 'true',
  fn: async () => {
    const run_result = await run(
      {
        chromePath: Deno.env.get('CHROME_PATH'),
      },
      {
        query: 'What is the meaning of life?',
      },
    );
    expect(run_result.response).toEqual(expect.any(String));
  },
});
