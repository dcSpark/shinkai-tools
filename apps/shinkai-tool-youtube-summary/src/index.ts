import { YoutubeTranscript } from 'npm:youtube-transcript';
import OpenAI from 'npm:openai';

type Config = {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
};
type Params = {
  url: string;
};
type Result = { summary: string };

export const run: Run<Config, Params, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  console.log(`transcripting ${parameters.url}`);

  // Get transcription
  const transcript = await YoutubeTranscript.fetchTranscript(parameters.url);

  // Send to ollama to build a formatted response
  const message: OpenAI.ChatCompletionUserMessageParam = {
    role: 'user',
    content: `
      According to this transcription of a youtube video (which is in csv separated by ':::'):

      offset;text
      ${transcript.map((v) => `${Math.floor(v.offset)}:::${v.text}`).join('\n')}
      ---------------

      The video URL is ${parameters.url}

      ---------------

      Write a detailed summary divided in sections along the video.
      Format the answer using markdown.
      Add markdown links referencing every section using this format https://www.youtube.com/watch?v={video_id}&t={offset} where 'offset' is a number and can be obtained from the transcription in csv format to generate the URL
    `,
  };

  let url = configurations?.apiUrl || 'http://127.0.0.1:11435';
  url = url?.endsWith('/v1') ? url : `${url}/v1`;
  const client = new OpenAI({
    baseURL: url,
    apiKey: configurations?.apiKey || '',
  });
  try {
    const response = await client.chat.completions.create({
      model: configurations?.model || 'llama3.1:8b-instruct-q4_1',
      messages: [message],
      stream: false,
    });
    return Promise.resolve({
      summary: response.choices[0]?.message?.content || '',
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
        type: 'string',
        description:
          'A markdown-formatted summary of the video content, divided into sections with timestamp links to relevant parts of the video.',
      },
    },
    required: ['summary'],
  },
};
