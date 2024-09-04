import { BaseTool, RunResult } from '@shinkai_protocol/shinkai-tools-builder';
import { ToolDefinition } from 'libs/shinkai-tools-builder/src/tool-definition';
import { TranscriptResponse, YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai';

type Config = {};
type Params = {
  url: string;
  apiUrl?: string;
  apiKey?: string;
  model: string;
};
type Result = { transcript: TranscriptResponse[]; message: string };

export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-youtube-transcript',
    name: 'Shinkai: YouTube Transcript',
    description: 'Retrieve the transcript of a YouTube video',
    author: 'Shinkai',
    keywords: ['youtube', 'transcript', 'video', 'captions', 'subtitles'],
    configurations: {
      type: 'object',
      properties: {},
      required: [],
    },
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL of the YouTube video to transcribe',
        },
        apiUrl: {
          type: 'string',
          description: 'The OpenAI api compatible URL',
          nullable: true,
        },
        apiKey: {
          type: 'string',
          description: 'Api Key to call OpenAI compatible endpoint',
          nullable: true,
        },
        model: {
          type: 'string',
          description: 'The model to use for generating the summary',
        },
      },
      required: ['url'],
    },
    result: {
      type: 'object',
      properties: {
        transcript: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              duration: { type: 'number' },
              offset: { type: 'number' },
              lang: { type: 'string', nullable: true },
            },
            required: ['text', 'duration', 'offset'],
          },
        },
        message: { type: 'string' },
      },
      required: ['transcript'],
    },
  };

  async run(params: Params): Promise<RunResult<Result>> {
    console.log(`transcripting ${params.url}`);

    // Get transcription
    const transcript = await YoutubeTranscript.fetchTranscript(params.url);

    // Send to ollama to build a formatted response
    const message: OpenAI.ChatCompletionUserMessageParam = {
      role: 'user',
      content: `
      According to this transcription of a youtube video (which is in csv separated by ';'):

      offset;text
      ${transcript.map((v) => `${Math.floor(v.offset)};${v.text}`).join('\n')}
      ---------------

      The video URL is ${params.url}

      ---------------

      Write a detailed summary divided in sections along the video.
      Format the answer using markdown.
      Add markdown links referencing every section using this format https://www.youtube.com/watch?v={video_id}&t={offset} where 'offset' is a number and can be obtained from the transcription in csv format to generate the URL
    `,
    };

    let url = params.apiUrl || 'http://127.0.0.1:11435';
    url = url?.endsWith('/v1') ? url : `${url}/v1`;
    console.log('url', url);
    const client = new OpenAI({
      baseURL: url,
      apiKey: params.apiKey || '',
    });
    try {
      const response = await client.chat.completions.create({
        model: params.model,
        messages: [message],
        stream: false,
      });
      return Promise.resolve({
        data: {
          transcript,
          message: response.choices[0]?.message?.content || '',
        },
      });
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  }
}
