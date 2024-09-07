import { Tool } from '../src/index';

test('exists definition', () => {
  const tool = new Tool({ apiKey: 'pplx-XXX' });
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});
