import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('run definition', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    inputValue: '0.005',
    assetSymbol: 'ETH',
  });
  console.log(run_result);
}, 25000);
