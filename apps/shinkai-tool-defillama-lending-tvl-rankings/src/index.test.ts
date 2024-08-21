import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});
test('run using all=false', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({ all: false });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(16);
  expect(run_result.data.rowsCount).toEqual(10);
}, 10000);
test('run using all=true', async () => {
  const tool = new Tool({
    chromePath: process.env?.CHROME_PATH,
  });
  const run_result = await tool.run({ all: true });
  console.log('table-csv', run_result.data.tableCsv);
  expect(run_result.data.columnsCount).toEqual(16);
  expect(run_result.data.rowsCount).toEqual(405);
}, 10000);
