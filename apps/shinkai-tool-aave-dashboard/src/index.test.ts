import { Tool } from '../src/index';

const timeout = 60 * 60 * 1000;

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test(
  'run definition',
  async () => {
    // const secretKey = 'b869541ac1dcd6ef40a9adb731908e67544314744db071b9fb45056a813048cd';
    const secretKey = '665e8f55fdaa6a0f109d263a1a0c83b4c0702862e3cda1d2339c950fe6fb0631';
    const tool = new Tool({
      chromePath: process.env?.CHROME_PATH,
    });
    const run_result = await tool.run({
      secretKey: `0x${secretKey}`,
    });

    console.log('suppliedAssets', run_result.data.suppliedAssets);
    console.log('borrowedAssets', run_result.data.borrowedAssets);
    console.log('toSupplyAssets', run_result.data.toSupplyAssets);
    console.log('toBorrowAssets', run_result.data.toBorrowAssets);

    expect(run_result).toBeInstanceOf(Object);
  },
  timeout,
);
