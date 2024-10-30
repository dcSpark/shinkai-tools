import { URL } from 'npm:whatwg-url';
import axios from 'npm:axios';
import process from 'node:process';

type Configurations = {};
type Parameters = {
  message: string;
};
type Result = { message: string };

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

export const run: Run<Configurations, Parameters, Result> = async (
  _configurations: Configurations,
  params: Parameters,
): Promise<Result> => {
  console.log('run duckduckgo search from js', 4);
  console.log('second message', 4);
  console.log('params: ', params);
  try {
    const results = await textSearch(params.message);
    console.log('results: ', results);
    return { message: JSON.stringify(results) };
  } catch (error) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { message: `Error: ${errorMessage}` };
  }
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-duckduckgo-search',
  name: 'Shinkai: DuckDuckGo Search',
  description:
    'Searches the DuckDuckGo search engine. Example result: [{"title": "IMDb Top 250 Movies", "description": "Find out which <b>movies</b> are rated as the <b>best</b> <b>of</b> <b>all</b> <b>time</b> by IMDb users. See the list of 250 titles sorted by ranking, genre, year, and rating, and learn how the list is determined.", "url": "https://www.imdb.com/chart/top/"}]',
  author: 'Shinkai',
  keywords: ['duckduckgo', 'search', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {},
    required: [],
  },
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
  result: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
};
