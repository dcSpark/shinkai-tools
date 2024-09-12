import { Tool } from '../src/index';

test('exists definition', async () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('transcript video', async () => {
  const tool = new Tool({});
  const result = await tool.run({
    url: 'https://www.youtube.com/watch?v=SUj34OWkjXU',
  });

  expect(result.data.summary.url).toBeDefined();
  expect(result.data.summary.sections.length).toBeGreaterThan(0);
  console.log("summmary", JSON.stringify(result.data.summary, null, 2));
}, 30000);


// test('transcript video using openai', async () => {
//   const tool = new Tool({
//     apiUrl: 'https://api.openai.com/v1',
//     apiKey: '',
//     model: 'gpt-4o'
//   });
//   const result = await tool.run({
//     url: 'https://www.youtube.com/watch?v=CQdaQr3EW8g',
//   });
//   expect(result.data.summary.url).toBeDefined();
//   expect(result.data.summary.sections.length).toBeGreaterThan(0);
//   console.log(result.data.summary);
// }, 30000);
