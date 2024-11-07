import process from 'node:process';
import { run } from './index.ts';
import { expect } from 'jsr:@std/expect';

// TODO: enable this test again when fix the tool
// Deno.test({
//   name: 'echo',
//   sanitizeResources: false,
//   sanitizeOps: false,
//   fn: async () => {
//     const result = await run(
//       {
//         chromePath: process.env?.CHROME_PATH,
//       },
//       {
//         inputValue: '0.005',
//         assetSymbol: 'ETH',
//       },
//     );
//     expect(result.amountProcessed).toBeDefined();
//   },
// });
