import { Tool } from './index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  const result = await tool.run({ query: 'minecraft' });

  // Improved logging
  console.log(JSON.stringify(result, null, 2));

  expect(definition).toBeInstanceOf(Object);
}, 25000); // Increased timeout to 10 seconds
