import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  const result = await tool.run({ address: '0xaecd92aec5bfbe2f5a02db2dee90733897360983' });
  expect(definition).toBeInstanceOf(Object);
});
