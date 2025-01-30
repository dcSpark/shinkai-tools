import { expect } from 'jsr:@std/expect/expect';
import { run } from './tool.ts';

Deno.test('exists definition', () => {
  expect(run).toBeInstanceOf(Function);
});
