import { Tool } from '../src/index';

test('exists definition', () => {
  const tool = new Tool({ apiKey: 'foobar' });
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});
