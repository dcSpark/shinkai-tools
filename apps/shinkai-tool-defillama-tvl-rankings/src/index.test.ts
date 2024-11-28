import { expect } from 'jsr:@std/expect/expect';
import { definition, findNetworkName, run } from './index.ts';
import process from 'node:process';

Deno.test('exists definition', () => {
  expect(definition).toBeInstanceOf(Object);
});

Deno.test({
  name: 'run using top10=false, categoryName=Liquid Staking, networkName=Ethereum',
  ignore: Deno.env.get('CI') === 'true' || Deno.build.os === 'windows',
  fn: async () => {
    const run_result = await run(
      {
        chromePath: process.env?.CHROME_PATH,
      },
      {
        top10: false,
        categoryName: 'Liquid Staking',
        networkName: 'Ethereum',
      },
    );
    console.log('table-csv', run_result.tableCsv);
    expect(run_result.columnsCount).toEqual(12);
    expect(run_result.rowsCount).toBeGreaterThan(10);
  },
});

Deno.test('test `findNetworkName` method', () => {
  expect(findNetworkName('base')).toEqual('Base');
  expect(findNetworkName('near')).toEqual('Near');
  expect(findNetworkName('sui')).toEqual('Sui');
  expect(findNetworkName('eThEReum')).toEqual('Ethereum');
  expect(findNetworkName('sOlANa')).toEqual('Solana');
  expect(findNetworkName('aRbITrum')).toEqual('Arbitrum');
  expect(findNetworkName('cArDAno')).toEqual('Cardano');
  expect(findNetworkName('bsc')).toEqual('BSC');
  expect(findNetworkName('undefined')).toEqual('undefined');
  expect(findNetworkName('')).toEqual(undefined);
  expect(findNetworkName(' ')).toEqual(undefined);
});
