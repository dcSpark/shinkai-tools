export const run: Run<{}, { message: string }, { message: string }> = (
  _configurations,
  parameters,
): Promise<{ message: string }> => {
  console.log('run echo from js');
  return Promise.resolve({
    message: `echoing: ${parameters.message}`,
  });
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-echo',
  name: 'Shinkai: Echo',
  description: 'Echoes the input message',
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
