import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import chromePaths from "npm:chrome-paths@1.0.1"
import * as cheerio from "npm:cheerio@1.0.0"
const reddit_url = 'https://www.reddit.com';

type Configurations = {
  chromePath?: string;
};
type Inputs = {
  action: 'subreddit' | 'post';
  subreddit?: string;
  post_url?: string;
  get_by?: 'hot' | 'new' | 'top' | 'rising';
  top_time?: 'day' | 'week' | 'month' | 'year' | 'all';
};
type Output = {
  subreddit?: SubReddit;
  post?: RedditPost;
  error?: string;
};

interface SubReddit {
  title: string;
  description: string;
  url: string;
  posts: RedditPost[];
}

interface RedditPost {
  title: string;
  author: string;
  text: string;
  url: string;
  num_comments: number;
  karma: number;
  comments: RedditComment[];
  image?: string;
  link?: string;
}

interface RedditComment {
  text: string;
  author: string;
  karma: number;
  op: boolean;
  replies: RedditComment[];
}

interface GetSubredditOptions {
  subreddit: string;
  get_by?: 'hot' | 'new' | 'top' | 'rising';
  top_time?: 'day' | 'week' | 'month' | 'year' | 'all';
}

const randomDelay = (min: number, max: number) => new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));

async function getSubredditWithPuppeteer(
  subreddit: GetSubredditOptions,
  chromePath: string,
): Promise<SubReddit> {
  let url = reddit_url + '/r/' + subreddit.subreddit + '/' + subreddit.get_by + '/'
  if (subreddit.get_by === 'top') url += `?t=${subreddit.top_time}`
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  
  try {
    const page = await browser.newPage();
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    // Add random delay before loading page
    await randomDelay(1000, 3000);
    
    await page.goto('https://duckduckgo.com/', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    // Wait for content to load
    await page.waitForSelector('.main');
    
    // Get page content
    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);
    const main = $('shreddit-feed').first();
    const posts = main.find('article');
    const description = $('shreddit-subreddit-header').attr('description')
    const result: SubReddit = {
      title: $('title').text().trim(),
      description: description || '', 
      url: url,
      posts: []
    };
    posts.each((i,articleEl) => {
      const article = $(articleEl);
      // Get the inner <shreddit-post> element which holds the data as attributes
      const postElem = article.find('shreddit-post');
      // Extract the title from either the attribute or fallback to the article aria-label.
      const title = postElem.attr('post-title') || article.attr('aria-label') || '';
      // The reddit post URL (permalink) is available on the <shreddit-post>
      const link = postElem.attr('content-href') || '';
      const url = 'https://www.reddit.com'+postElem.attr('permalink') || '';
      // Parse the comment count and karma (score) as numbers
      const num_comments = parseInt(postElem.attr('comment-count') || '0', 10);
      const karma = parseInt(postElem.attr('score') || '0', 10);
      // Extract text content if this is a text post.
      let text = '';
      if (postElem.attr('post-type') === 'text') {
        text = postElem.find('a[slot="text-body"]').text().trim();
      }
      // Create the RedditPost object and push it into the posts array.
      result.posts.push({
        title,
        author: postElem.attr('author') || '',
        text,
        url,
        link,
        num_comments,
        karma,
        comments: [] // populate comments if you later extract them
      });
    });
    
    // Now posts is of type RedditPost[]
    await browser.close();
    return result;
  } catch (error) {
    console.error('Error during scraping:', error);
    await browser.close();
    throw error;
  }
}

async function getPostWithPuppeteer(
  post_url: string,
  chromePath: string,
): Promise<RedditPost> {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  // Visit DuckDuckGo first to appear more natural
  await page.goto('https://duckduckgo.com', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });
  
  // Add a small delay to simulate human behavior
  await randomDelay(1000, 3000);
  await page.goto(post_url, {
    waitUntil: 'networkidle0',
    timeout: 30000
  });
  await page.waitForSelector('.main');
  // Click "View more comments" button if present
  try {
    const loadMoreSelector = 'faceplate-tracker[noun="load_more_comments"]';
    // await page.waitForSelector(loadMoreSelector, {timeout: 5000});
    const loadMoreButton = await page.$(loadMoreSelector);
    if (loadMoreButton) {
      console.log('load More Comments Button Found');
      await loadMoreButton.click();
      // Wait for new comments to load
      await randomDelay(2000, 3000);
    }
  } catch (moreCommentsError) {
    // Button not found or other error, continue
    console.error('Error loading more comments:', moreCommentsError);
  }
  const pageContent = await page.content();
  const $ = cheerio.load(pageContent);
  const main = $('shreddit-post').first();
  const result: RedditPost = {
    title: $('title').text().trim(),
    author: main.attr('author') || '',
    text: main.find('.md').text().trim(), // Get text from .md class
    url: post_url,
    num_comments: parseInt(main.attr('comment-count') || '0', 10),
    karma: parseInt(main.attr('score') || '0', 10), 
    comments: []
  };
  if (main.attr('post-type') === 'image') {
    result.image = $('#post-image')?.attr('src') || '';
  } else if (main.attr('post-type') === 'link') {
    result.link = main.attr('content-href') || '';
  }
  const comments = $('shreddit-comment-tree').first()
    .children('shreddit-comment');
  console.log(comments.length);
  comments.each((i, commentEl) => {
    const comment = $(commentEl);
    const commentResult: RedditComment = {
      text: comment.find('.md').text().trim(),
      author: comment.attr('author') || '',
      op: comment.attr('author') === result.author,
      karma: parseInt(comment.attr('score') || '0', 10),
      replies: []
    };
    result.comments.push(commentResult);
    const replies = comment.children('shreddit-comment');
    replies.each((i, replyEl) => {
      const reply = $(replyEl);
      const replyResult: RedditComment = {
        text: reply.find('.md').text().trim(),
        author: reply.attr('author') || '',
        op: reply.attr('author') === result.author,
        karma: parseInt(reply.attr('score') || '0', 10),
        replies: []
      }
      commentResult.replies.push(replyResult);
      //console.log('reply:', $.html(reply.children()));
      const replyreply = reply.children().filter((i, el) => $(el).is('shreddit-comment'));
      console.log('replyreply:', replyreply.length);
      replyreply.each((i, replyreplyEl) => {
        const replyreply = $(replyreplyEl);
        const replyreplyResult: RedditComment = {
          text: replyreply.find('.md').text().trim(),
          author: replyreply.attr('author') || '',
          karma: parseInt(replyreply.attr('score') || '0', 10),
          replies: []
        }
        replyResult.replies.push(replyreplyResult);
      });
    });
  });
  await browser.close();
  return result;
}

type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;
export const run: Run<Configurations, Inputs, Output> = async (
  configurations: Configurations,
  inputs: Inputs,
): Promise<Output> => {
  const chromePath = configurations?.chromePath || 
  Deno.env.get('CHROME_PATH') ||
  chromePaths.chrome || 
  chromePaths.chromium;
  try {
    if (inputs.action === 'subreddit') {
      if (!inputs.subreddit) throw new Error('subreddit is required');
      const result = await getSubredditWithPuppeteer({
        subreddit: inputs.subreddit,
        get_by: inputs.get_by ?? 'hot',
        top_time: inputs.top_time ?? 'day'
      }, chromePath);
      return {
        subreddit: result
      };
    } else if (inputs.action === 'post') {
      if (!inputs.post_url) throw new Error('post_url is required');
      const result = await getPostWithPuppeteer(inputs.post_url, chromePath);
      return {
        post: result
      };
    }
    return {
      error: 'Invalid action, use "subreddit" or "post"'
    };
  } catch (error) {
    console.error(error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/*

Examples of use:

const result = await run({
  action: 'subreddit',
  subreddit: 'shinkai'
});


const result = await run({
  action: 'post',
  post_url: 'https://www.reddit.com/r/shinkai/comments/1234567890'
});

*/