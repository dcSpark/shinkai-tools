import { expect } from 'jsr:@std/expect/expect';
import { run } from './index.ts';

Deno.test('searches DuckDuckGo and gets a response', async () => {
  const result = await run({}, { message: 'best movie of all time' });
  const message = result.message;
  const searchResults = JSON.parse(message.replace(/^searching: /, ''));

  expect(Array.isArray(searchResults)).toBe(true);
  expect(searchResults.length).toBeGreaterThan(0);
  expect(searchResults[0]).toHaveProperty('title');
  expect(searchResults[0]).toHaveProperty('url'); // Updated from 'href' to 'url'
  expect(searchResults[0]).toHaveProperty('description'); // Updated from 'body' to 'description'
});
