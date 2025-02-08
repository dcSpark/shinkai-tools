import { shinkaiLlmPromptProcessor, redditScraper } from './shinkai-local-tools.ts'

type Configurations = {
  post_guidelines: string;
}

type Inputs = {
  subreddit: string;
  get_by: 'hot' | 'new' | 'top' | 'rising';
  top_time: 'day' | 'week' | 'month' | 'year' | 'all';
}

type Output = {
  post_title: string;
  post_content: string; // Markdown blog post
}

export const run = async (config: Configurations, inputs: Inputs) => {
  const {subreddit} = await redditScraper({
    action: 'subreddit',
    subreddit: inputs.subreddit,
    get_by: inputs.get_by,
    top_time: inputs.top_time
  });
  const posts = subreddit?.posts || [];
  const postContexts: string[] = []
  for (const post of posts.slice(0,4)) {
    const postContext = await redditScraper({
      action: 'post',
      post_url: post.url
    });
    postContexts.push(`
      ${JSON.stringify(postContext.post)}
    `);
  }
  const llmResponse = await shinkaiLlmPromptProcessor({
    prompt: `
    Write a blog post about the following posts:
    <posts>
    ${postContexts.join('\n\n')}
    </posts>
    Please follow the following guidelines:
    <guidelines>
    ${config.post_guidelines}
    </guidelines>
    You must output the post title and the post content wrapped in <post_title> and <post_content> tags respectively.
    `,
    format: 'text',
  });
  const post_title = llmResponse.message.match(/<post_title>(.*?)<\/post_title>/)?.[1] || '';
  let post_content = llmResponse.message.match(/<post_content>(.*?)<\/post_content>/)?.[1] || '';
  if (!post_content) post_content = llmResponse.message.split('<post_content>')[1]
  post_content = post_content
    .replace(/<br>/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/<\/post_content>/g, '')
  return {
    post_title,
    post_content
  };
}
