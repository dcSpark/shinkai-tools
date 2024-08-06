import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('fetches BTC price', async () => {
  const tool = new Tool({});
  const result = await tool.run({ symbol: 'BTC' });

  // Improved logging
  console.log(JSON.stringify(result, null, 2));

  expect(result.data).toHaveProperty('symbol', 'BTC');
  expect(result.data).toHaveProperty('price');
  expect(typeof result.data.price).toBe('number');
});

test('fetches ARB price', async () => {
  const tool = new Tool({});
  const result = await tool.run({ symbol: 'AAVE' });

  // Improved logging
  console.log(JSON.stringify(result, null, 2));

  expect(result.data).toHaveProperty('symbol', 'AAVE');
  expect(result.data).toHaveProperty('price');
  expect(typeof result.data.price).toBe('number');
});
