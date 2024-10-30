import { run } from './index.ts';
import { assertEquals } from 'jsr:@std/assert';

Deno.test('echo', async () => {
  const result = await run({}, { message: 'hi' });
  assertEquals(result.message, 'echoing: hi');
});
