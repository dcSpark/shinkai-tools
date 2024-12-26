import { YoutubeTranscript } from 'npm:youtube-transcript@1.2.1';
import OpenAI from 'npm:openai@4.71.0';

type Config = {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
};
type Params = {
  url: string;
  lang?: string;
};
type Result = { summary: string };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Config, Params, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  console.log(`transcripting ${parameters.url}`);

  // Get transcription
  const transcript = await YoutubeTranscript.fetchTranscript(parameters.url, {
    lang: parameters.lang || 'en',
  });

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
    // Fallback to 11434 if apiUrl is not set
    if (!configurations.apiUrl) {
      console.log('Retrying with fallback URL http://127.0.0.1:11434');
      const fallbackClient = new OpenAI({
        baseURL: 'http://127.0.0.1:11434/v1',
        apiKey: configurations?.apiKey || '',
      });
      try {
        const fallbackResponse = await fallbackClient.chat.completions.create({
          model: configurations?.model || 'llama3.1:8b-instruct-q4_1',
          messages: [message],
          stream: false,
        });
        return Promise.resolve({
          summary: fallbackResponse.choices[0]?.message?.content || '',
        });
      } catch (fallbackError) {
        console.error('Error calling fallback Ollama API:', fallbackError);
        throw fallbackError;
      }
    } else {
      throw error;
    }
  }
};
