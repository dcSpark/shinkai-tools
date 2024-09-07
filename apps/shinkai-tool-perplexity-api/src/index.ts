import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import TurndownService from 'turndown';
import axios from 'axios';

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
    name: 'Shinkai: Perplexity API',
    description: 'Searches the web using Perplexity API (limited)',
    author: 'Shinkai',
    keywords: ['perplexity', 'api', 'shinkai'],
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
