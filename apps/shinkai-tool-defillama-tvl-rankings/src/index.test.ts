import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('run using top10=false, categoryName=Liquid Staking, networkName=Ethereum', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: false,
    categoryName: 'Liquid Staking',
    networkName: 'Ethereum',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(12);
  expect(run_result.data.rowsCount).toBeGreaterThan(10);
}, 10000);

test('test `findNetworkName` method', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });

  expect(tool.findNetworkName('base')).toEqual('Base');
  expect(tool.findNetworkName('near')).toEqual('Near');
  expect(tool.findNetworkName('sui')).toEqual('Sui');
  expect(tool.findNetworkName('eThEReum')).toEqual('Ethereum');
  expect(tool.findNetworkName('sOlANa')).toEqual('Solana');
  expect(tool.findNetworkName('aRbITrum')).toEqual('Arbitrum');
  expect(tool.findNetworkName('cArDAno')).toEqual('Cardano');
  expect(tool.findNetworkName('bsc')).toEqual('BSC');
  expect(tool.findNetworkName('undefined')).toEqual('undefined');
  expect(tool.findNetworkName('')).toEqual(undefined);
  expect(tool.findNetworkName(' ')).toEqual(undefined);
}, 30000);
