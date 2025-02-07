import axios from 'npm:axios@1.7.7';

type Configurations = {
  limit?: number;  // Optional limit of stories to fetch, defaults to 10
};

type Parameters = {};  // No input parameters needed

type Result = {
  stories: Array<{
    title: string;
    author: string;
    url: string;
  }>;
};

export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  _params: Parameters,
): Promise<Result> => {
  // Ensure limit is a positive number between 1 and 10
  const requestedLimit = configurations.limit ?? 10;
  const limit = Math.min(Math.max(1, requestedLimit), 10);
  
  const TOP_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
  const ITEM_URL = 'https://hacker-news.firebaseio.com/v0/item';

  try {
    // Fetch top stories IDs
    const response = await axios.get(TOP_STORIES_URL);
    const storyIds = response.data.slice(0, limit);

    // Fetch details for each story
    const stories = await Promise.all(
      storyIds.map(async (id: number) => {
        const storyResponse = await axios.get(`${ITEM_URL}/${id}.json`);
        const story = storyResponse.data;

        if (story && story.type === 'story') {
          return {
            title: story.title || '',
            author: story.by || '',
            url: story.url || `https://news.ycombinator.com/item?id=${id}`,
          };
        }
        return null;
      }),
    );

    // Filter out null values and return results
    return {
      stories: stories.filter((story): story is NonNullable<typeof story> => story !== null),
    };
  } catch (error) {
    console.error('Error fetching Hacker News stories:', error);
    return { stories: [] };
  }
}; 