import { expect } from 'jsr:@std/expect/expect';
import { definition, run } from './index.ts';

Deno.test('exists definition', () => {
  expect(definition).toBeInstanceOf(Object);
});

Deno.test('fetches BTC price', async () => {
  const result = await run({}, { symbol: 'BTC' });

  // Improved logging
  console.log(JSON.stringify(result, null, 2));

  expect(result).toHaveProperty('symbol', 'BTC');
  expect(result).toHaveProperty('price');
  expect(typeof result.price).toBe('number');
});

Deno.test('fetches ARB price', async () => {
  const result = await run({}, { symbol: 'AAVE' });

  // Improved logging
  console.log(JSON.stringify(result, null, 2));

  expect(result).toHaveProperty('symbol', 'AAVE');
  expect(result).toHaveProperty('price');
  expect(typeof result.price).toBe('number');
});
