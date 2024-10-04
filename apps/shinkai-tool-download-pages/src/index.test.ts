import { Tool } from './index';
test('exists definition', () => {
  const tool = new Tool({});
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

// Note: Uncomment for running locally
// test('can download and convert two pages to Markdown', async () => {
//   const tool = new Tool({});
//   const params = {
//     urls: [
//       'https://en.wikipedia.org/wiki/MTOR',
//       'https://en.wikipedia.org/wiki/Xkcd'
//     ]
//   };

//   const result = await tool.run(params);

//   expect(result.data.markdowns).toHaveLength(2);
//   result.data.markdowns.forEach(markdown => {
//     expect(markdown).toContain('#'); // Basic check to see if Markdown content is present
//   });
// });
