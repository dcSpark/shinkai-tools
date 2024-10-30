import { expect } from 'jsr:@std/expect/expect';
import { definition, run } from './index.ts';

Deno.test('exists definition', async () => {
  expect(definition).toBeInstanceOf(Object);
});

Deno.test('return something', async () => {
  const result = await run({}, { message: 'hi' });
  expect(result.message).toBe('hello world foobar');
});
