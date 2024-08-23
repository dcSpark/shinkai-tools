import { Tool } from '../src/index';

test('exists definition', () => {
  const tool = new Tool({ apiKey: 'pplx-XXX' });
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('fetches Bitcoin price', async () => {
  const tool = new Tool({ apiKey: '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' });
  const result = await tool.run({ query: "What's the price of Bitcoin right now?" });
  console.log(result);
  expect(result.data.response).toContain('Bitcoin');
});
