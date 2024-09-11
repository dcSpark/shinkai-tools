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

test('run using top10=false, categoryName=Lending', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: false,
    categoryName: 'Lending',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(15);
  expect(run_result.data.rowsCount).toBeGreaterThan(10);
}, 10000);

test('run using top10=false, categoryName=Yield Aggregator, networkName=BSC', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: true,
    categoryName: 'Yield AGGREGATOR',
    networkName: 'bsc',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(8);
  expect(run_result.data.rowsCount).toBe(10)
}, 10000);

test('run using top10=false, categoryName=Derivatives', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: true,
    categoryName: 'Derivatives',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(14);
  expect(run_result.data.rowsCount).toBe(10)
}, 10000);

test('run using top10=false, categoryName=DEXES, networkName=BSC', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: false,
    categoryName: 'DEXES',
    networkName: 'BSC',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toBeGreaterThanOrEqual(12);
  expect(run_result.data.rowsCount).toBeGreaterThan(10);
}, 10000);

test('run using top10=false, categoryName=LiquId StAkInG, networkName=eth', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: false,
    categoryName: 'LiquId StAkInG',
    networkName: 'eTheReum',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(12);
  expect(run_result.data.rowsCount).toBeGreaterThan(10);
}, 10000);

test('run using top10=false, categoryName=LiquId StAkInG, networkName=Solana', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: false,
    categoryName: 'LiquId StAkInG',
    networkName: 'Solana',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(12);
  expect(run_result.data.rowsCount).toBeGreaterThan(10);
}, 10000);

test('run using top10=true, categoryName=Liquid Staking', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({
    top10: true,
    categoryName: 'Liquid Staking',
  });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(12);
  expect(run_result.data.rowsCount).toEqual(10);
}, 10000);

test('run using top10=true, categoryName=NonExistingCategory, networkName=Ethereum', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  
  await expect(tool.run({
    top10: true,
    categoryName: 'NonExistingCategory',
    networkName: 'Ethereum',
  })).rejects.toThrow('Category NonExistingCategory not found');
}, 10000);

test('test `findCategoryFromArray` method', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });

  tool.withPage(async (page) => {
    const categories = await tool.getCategories(page);

    expect(tool.findCategoryFromArray('Liquid Staking', categories)).toEqual(
      'Liquid Staking',
    );
    expect(tool.findCategoryFromArray('LIQUID Staking', categories)).toEqual(
      'Liquid Staking',
    );
    expect(tool.findCategoryFromArray('Liquid STAKING', categories)).toEqual(
      'Liquid Staking',
    );
    expect(tool.findCategoryFromArray('LIQUID STAKING', categories)).toEqual(
      'Liquid Staking',
    );
    expect(tool.findCategoryFromArray('LiQuiD StakIng', categories)).toEqual(
      'Liquid Staking',
    );
  });
}, 30000);

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