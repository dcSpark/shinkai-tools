import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  const result = await tool.run({ message: 'hi' });
  expect(definition).toBeInstanceOf(Object);
  expect(result.data.message).toBe('hello world foobar');
});
