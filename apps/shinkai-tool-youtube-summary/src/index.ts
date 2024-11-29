import { YoutubeTranscript } from 'npm:youtube-transcript@1.2.1';
import OpenAI from 'npm:openai@4.71.0';
import { ClientRegistry } from 'npm:@boundaryml/baml';
import { b, YoutubeVideoSummary } from 'npm:baml_client';

type Config = {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
};
type Params = {
  url: string;
  lang?: string;
};
type Result = { summary: YoutubeVideoSummary };

export const run: Run<Config, Params, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  // Get transcription
  const transcript = await YoutubeTranscript.fetchTranscript(parameters.url, {
    lang: parameters.lang || 'en',
  });

  let url = configurations?.apiUrl || 'http://127.0.0.1:11435';
  url = url?.endsWith('/v1') ? url : `${url}/v1`;

  const cr = new ClientRegistry();
  cr.addLlmClient('LlmClient', 'openai', {
    base_url: url,
    model: configurations?.model || 'llama3.1:8b-instruct-q4_1',
    api_key: configurations?.apiKey || '',
  });
  cr.setPrimary('LlmClient');

  // Get transcription
  const transcript = await YoutubeTranscript.fetchTranscript(parameters.url);

  const summary = await b.SummarizeYoutubeVideo(
    parameters.url,
    `
      offset:::text
      ${transcript.map((v) => `${Math.floor(v.offset)}:::${v.text}`).join('\n')}
    `,
    { clientRegistry: cr },
  );

  try {
    return Promise.resolve({
      summary,
    });
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-youtube-summary',
  name: 'Shinkai: YouTube Video Summary',
  description:
    'Summarizes a YouTube video. Provides a summary with organized sections and clickable timestamp links. Useful for quickly grasping main points, preparing for discussions, or efficient research. Example uses: summarizing tech talks, product reviews, or educational lectures. Parameters: url (string) - The full YouTube video URL to process.',
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
      lang: {
        type: 'string',
        description:
          'The language code for the transcript in ISO 639-1 format (e.g. "en" for English). Optional. If not specified, will use the default available transcript.',
        example: 'en',
        nullable: true,
      },
    },
    required: ['url'],
  },
  result: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description:
          'A markdown-formatted summary of the video content, divided into sections with timestamp links to relevant parts of the video.',
      },
    },
    required: ['summary'],
  },
};
