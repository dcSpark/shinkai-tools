---
to: apps/shinkai-tool-<%= name %>/src/index.test.ts
---
import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});
