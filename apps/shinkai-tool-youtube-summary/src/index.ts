import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { YoutubeTranscript } from 'youtube-transcript';
import { ClientRegistry } from '@boundaryml/baml';
import { b, YoutubeVideoSummary } from 'baml_client';

type Config = {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
};
type Params = {
  url: string;
};
type Result = { summary: YoutubeVideoSummary };

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-youtube-summary',
    name: 'Shinkai: YouTube Video Summary',
    description:
      'Summarizes a YouTube video content without watching. Provides a summary with organized sections and clickable timestamp links. Useful for quickly grasping main points, preparing for discussions, or efficient research. Example uses: summarizing tech talks, product reviews, or educational lectures. Parameters: url (string) - The full YouTube video URL to process.',
    author: 'Shinkai',
    keywords: [
      'youtube',
      'transcript',
      'video',
      'summary',
      'sections',
      'timestamp',
      'links',
    ],
    configurations: {
      type: 'object',
      properties: {
        apiUrl: {
          type: 'string',
          description:
            'The URL of the OpenAI compatible API endpoint for summary generation. Optional. Default: "http://127.0.0.1:11435".',
          nullable: true,
          example: 'https://api.openai.com/v1',
        },
        apiKey: {
          type: 'string',
          description:
            'The API key for the OpenAI compatible endpoint. Required if using a service that needs authentication.',
          nullable: true,
          example: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        model: {
          type: 'string',
          description:
            'The name of the language model for summary generation. Optional. Default: "llama3.1:8b-instruct-q4_1".',
          nullable: true,
          example: 'gpt-3.5-turbo',
        },
      },
      required: [],
    },
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'The full URL of the YouTube video to transcribe and summarize. Must be a valid and accessible YouTube video link.',
          example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      },
      required: ['url'],
    },
    result: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the YouTube video that was summarized.',
            },
            briefSummary: {
              type: 'string',
              description: 'A concise overview of the entire video content.',
            },
            sections: {
              type: 'array',
              description:
                'An array of sections representing key parts of the video.',
              items: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description:
                      'The URL of the YouTube video for this section.',
                  },
                  title: {
                    type: 'string',
                    description:
                      'The title for this section.',
                  },
                  offset: {
                    type: 'integer',
                    description: 'The starting time of the section in seconds.',
                  },
                  keyPoints: {
                    type: 'array',
                    description:
                      'Main points or takeaways from this section of the video.',
                    items: {
                      type: 'string',
                    },
                  },
                },
                required: ['offset', 'keyPoints'],
              },
            },
          },
          required: ['url', 'briefSummary', 'sections'],
          description:
            'An object containing the detailed summary of the YouTube video.',
        },
      },
      required: ['summary'],
      description: 'The result object containing the video summary.',
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    console.log(`transcripting ${params.url}`);

    let url = this.config?.apiUrl || 'http://127.0.0.1:11435';
    url = url?.endsWith('/v1') ? url : `${url}/v1`;

    const cr = new ClientRegistry();
    cr.addLlmClient('LlmClient', 'openai', {
      base_url: url,
      model: this.config?.model || 'llama3.1:8b-instruct-q4_1',
      api_key: this.config?.apiKey || '',
    });
    cr.setPrimary('LlmClient');

    // Get transcription
    const transcript = await YoutubeTranscript.fetchTranscript(params.url);

    const summary = await b.SummarizeYoutubeVideo(
      params.url,
      `
      offset:::text
      ${transcript.map((v) => `${Math.floor(v.offset)}:::${v.text}`).join('\n')}
    `,
      { clientRegistry: cr },
    );

    try {
      return Promise.resolve({
        data: {
          summary,
        },
      });
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  }
}
