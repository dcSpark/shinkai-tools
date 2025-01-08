---
to: apps/shinkai-tool-<%= name %>/src/index.ts
---
export const run: Run<{}, { message: string }, { message: string }> = (
  configurations,
  parameters,
): Promise<{ message: string }> => {
  const message = `hello world <%= name %>`;
  console.log(message);
  return Promise.resolve({ message });
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-<%= name %>',
  name: 'Shinkai: <%= name %>',
  description: 'New <%= name %> tool from template',
  author: 'Shinkai',
  keywords: ['echo', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {},
    required: [],
  },
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
  result: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
};
