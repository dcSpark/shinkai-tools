---
to: apps/shinkai-tool-<%= name %>/src/index.test.ts
---
import { expect } from 'jsr:@std/expect/expect';
import { definition } from './index.ts';

Deno.test('exists definition', () => {
  expect(definition).toBeInstanceOf(Object);
});
