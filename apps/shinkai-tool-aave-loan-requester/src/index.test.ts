import { Tool } from '../src/index';

const timeout = 25000;

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('run definition', async () => {
  const secretKey = 'b869541ac1dcd6ef40a9adb731908e67544314744db071b9fb45056a813048cd';
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    inputValue: '0.005',
    assetSymbol: 'ETH',
    secretKey: `0x${secretKey}`,
  });
  console.log(run_result);
}, timeout);
