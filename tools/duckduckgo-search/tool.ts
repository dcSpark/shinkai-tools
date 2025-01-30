/// <reference lib="deno.ns" />
/// <reference lib="dom" />
import { URL } from 'npm:whatwg-url@14.0.0';
import axios from 'npm:axios@1.7.7';
import process from 'node:process';
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import chromePaths from "npm:chrome-paths@1.0.1"

type Configurations = {
  chromePath?: string;
};
type Parameters = {
  message: string;
};
type Result = { message: string, puppeteer: boolean };

interface SearchResult {
  title: string;
  description: string;
  url: string;
}

// Custom function to build query string
function buildQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`,
    )
    .join('&');
}

const getVQD = async (keywords: string): Promise<string> => {
  const body = buildQueryString({ q: keywords });
  await process.nextTick(() => {});
  const response = await axios.post('https://duckduckgo.com', body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const text = response.data;
  // console.log('DuckDuckGo response HTML:', text);

  // Extract vqd token using a regular expression
  const vqdMatch = text.match(/vqd=\\?"([^\\"]+)\\?"/);
  // console.log('vqdMatch: ', vqdMatch);
  if (!vqdMatch || vqdMatch.length < 2) {
    throw new Error('Failed to retrieve vqd token');
  }
  const vqd = vqdMatch[1];
  // console.log('vqd: ', vqd);
  return vqd;
};

const parseDuckDuckGoResponse = (response: string): SearchResult[] => {
  // Regex to extract the JSON content
  const jsonPattern = /DDG\.pageLayout\.load\('d',(\[\{\"a\".*?\}\])\);/;
  const match = response.match(jsonPattern);

  if (!match) {
    throw new Error('JSON content not found in the response.');
  }

  // Extracted JSON content as string
  const jsonString = match[1];

  // Parse JSON string
  const jsonData = JSON.parse(jsonString);

  // Extract search results
  const results: SearchResult[] = jsonData
    .map((item: any) => ({
      title: item.t,
      description: item.a,
      url: item.u,
    }))
    .filter(
      (result: SearchResult) =>
        result.title && result.description && result.url,
    );

  // console.log('results: ', results);
  // Convert to JSON string
  return results;
};

const textSearch = async (keywords: string): Promise<any[]> => {
  console.log('textSearch: ', keywords);
  const vqd = await getVQD(keywords);
  console.log('vqd: ', vqd);
  const url = new URL('https://links.duckduckgo.com/d.js');
  console.log('before url.searchParams.append');
  url.searchParams.append('q', keywords);
  url.searchParams.append('vqd', vqd);
  url.searchParams.append('kl', 'wt-wt');
  url.searchParams.append('l', 'wt-wt');
  url.searchParams.append('p', '');
  url.searchParams.append('s', '0');
  url.searchParams.append('df', '');
  url.searchParams.append('ex', '-1');

  console.log('before urlString');
  const urlString = url.toString();
  console.log('urlString: ', urlString);

  await process.nextTick(() => {});
  const response = await axios.get(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  console.log('response: ', response);
  const text = response.data;
  console.log('DuckDuckGo search response:', text);

  // Parse the response using the custom parser
  const results = parseDuckDuckGoResponse(text);
  if (results.length === 0) {
    throw new Error('Failed to extract search results');
  }

  return results;
};


async function searchDuckDuckGoWithPuppeteer(
  searchQuery: string,
  chromePath: string,
  numResults = 10
): Promise<SearchResult[]> {
  // Add random delay between requests
  const randomDelay = (min: number, max: number) =>
    new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));

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

    // Type search query with random delays between keystrokes
    for (const char of searchQuery) {
      await page.type('#searchbox_input', char, { delay: Math.random() * 100 + 50 });
    }

    await Promise.all([
      page.keyboard.press('Enter'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    // Wait for results to load
    await page.waitForSelector('.react-results--main');
    const pageContent = await page.$('.react-results--main');
    let results: SearchResult[] = []
    if (pageContent) {
      // Process each `li` element inside the container
      results = await page.evaluate((container) => {
        // Query all `li` elements within the container
        const listItems = container.querySelectorAll('li[data-layout="organic"]');
        // Map each `li` to extract title, snippet, and URL
        return Array.from(listItems).map((item) => {
          // Extract the title
          const title = (item as HTMLElement).querySelector('article')?.children[2]?.querySelector('a')?.textContent?.trim() || 'No title';
          // Extract the snippet (if there's more descriptive text inside the article)
          const description = (item as HTMLElement).querySelector('article')?.children[3]?.textContent?.trim() || 'No snippet';
          // Extract the URL (inside the <a> tag in the third child of <article>)
          const url = (item as HTMLElement).querySelector('article')?.children[2]?.querySelector('a')?.href || 'No URL';
          return { title, description, url };
        });
      }, pageContent);
    
      // Log the extracted results
      results.forEach((result, index) => {
        console.log(`Result ${index + 1}:`);
        console.log(`  Title: ${result.title}`);
        console.log(`  Description: ${result.description}`);
        console.log(`  URL: ${result.url}`);
      });
    }
    // Extract search results
    await browser.close();
    return results;
  } catch (error) {
    console.error('Error during scraping:', error);
    await browser.close();
    throw error;
  }
}


export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;
export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters,
): Promise<Result> => {
  let puppeteer = false
  console.log('run duckduckgo search from js', 4);
  console.log('second message', 4);
  console.log('params: ', params);
  try {
    let results;
    try {
      results = await textSearch(params.message);
    } catch (textSearchError) {
      console.error('Text search failed', textSearchError);
      console.log('Text search failed, falling back to puppeteer search');
      puppeteer = true
      const chromePath = configurations?.chromePath || 
        Deno.env.get('CHROME_PATH') ||
        chromePaths.chrome || 
        chromePaths.chromium;
      results = await searchDuckDuckGoWithPuppeteer(params.message, chromePath, 10);
    }
    console.log('results: ', results);
    return { message: JSON.stringify(results), puppeteer };
  } catch (error) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { message: `Error: ${errorMessage}`, puppeteer };
  }
};