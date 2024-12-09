import { expect } from 'jsr:@std/expect/expect';
import { definition, run } from './index.ts';

Deno.test('exists definition', () => {
  expect(definition).toBeInstanceOf(Object);
});

Deno.test({
  name: 'run',
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
