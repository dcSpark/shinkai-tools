import { Tool } from '../src/index';
global.fetch = require('node-fetch');

test('exists definition', () => {
  const tool = new Tool({ apiKey: 'pplx-XXX' });
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

// test('fetches Bitcoin price', async () => {
//   const tool = new Tool({ apiKey: 'pplx-XXX' });
//   const result = await tool.run({ query: "What's the price of Bitcoin right now?" });
//   console.log(result);
//   expect(result.data.response).toContain('Bitcoin');
// });
