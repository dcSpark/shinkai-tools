import {
  BaseTool,
  RunResult,
  ToolDefinition,
} from '@shinkai_protocol/shinkai-tools-builder';

type Config = {
  apiKey: string;
};
type Params = {
  query: string;
};
type Result = {
  response: string;
};

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-perplexity-api',
    name: 'Shinkai: Perplexity API Web Search',
    description: 'Search the web using Perplexity API',
    configurations: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
      },
      required: ['apiKey'],
    },
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    result: {
      type: 'object',
      properties: {
        response: { type: 'string' },
      },
      required: ['response'],
    },
    author: '',
    keywords: [],
  };

  async run(params: Params): Promise<RunResult<Result>> {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          { role: 'system', content: 'Be precise and concise.' },
          { role: 'user', content: params.query },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch data from Perplexity API, status: ${response.status}`,
      );
    }

    const data = (await response.json()) as PerplexityResponse;
    const responseContent =
      data.choices[0]?.message?.content || 'No information available';

    return { data: { response: responseContent } };
  }
}
