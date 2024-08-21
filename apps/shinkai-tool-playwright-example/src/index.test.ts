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
  const run_result = await tool.run({ url: 'https://shinkai.com' });
  expect(run_result.data.title).toBe(
    'Shinkai | Fully Local AI (Models, Files and Agents)',
  );
}, 15000);
