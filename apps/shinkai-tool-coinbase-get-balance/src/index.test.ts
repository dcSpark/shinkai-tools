import { Tool } from './index';

test('exists definition', async () => {
  const tool = new Tool({ name: 'test', privateKey: 'test', walletId: 'test' });
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});
