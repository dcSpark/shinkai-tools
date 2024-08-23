import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('run', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({ query: 'What is the meaning of life?' });
  expect(run_result.data.response).toEqual(expect.any(String));
}, 15000);
