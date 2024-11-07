type Configurations = {};
type Parameters = {
  message: string;
};
type Result = { message: string };

export const run: Run<Configurations, Parameters, Result> = (
  _configurations: Configurations,
  _params: Parameters,
): Promise<Result> => {
  const message = `hello world foobar`;
  console.log(message);
  return Promise.resolve({ message });
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-foobar',
  name: 'Shinkai: foobar',
  description: 'New foobar tool from template',
  author: 'Shinkai',
  keywords: ['foobar', 'shinkai'],
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
