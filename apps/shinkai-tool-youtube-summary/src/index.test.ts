import { expect } from 'jsr:@std/expect/expect';
import { definition, run } from './index.ts';

Deno.test('exists definition', () => {
  expect(definition).toBeInstanceOf(Object);
});

// Deno.test('transcript video', async () => {
//   const result = await run(
//     {
//       apiUrl: 'http://127.0.0.1:11434',
//     },
//     {
//       url: 'https://www.youtube.com/watch?v=SUj34OWkjXU',
//     },
//   );
//   expect(result.summary.length).toBeGreaterThan(0);
//   console.log(result.summary);
// });

// Deno.test('transcript video using openai', async () => {
//   const result = await run(
//     {
//       apiUrl: 'https://api.openai.com/v1',
//       apiKey: '',
//       model: 'gpt-4o',
//     },
//     {
//       url: 'https://www.youtube.com/watch?v=CQdaQr3EW8g',
//     },
//   );
//   expect(result.summary.length).toBeGreaterThan(0);
//   console.log(result.summary);
// });
