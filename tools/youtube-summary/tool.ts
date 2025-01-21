import { YoutubeTranscript } from 'npm:youtube-transcript@1.2.1';
import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts'

// Tool does not need any configuration
type CONFIG = Record<string, unknown>;

type INPUTS = {
  url: string;
  lang?: string;
};

type OUTPUT = { summary: string };

export const run: Run<CONFIG, INPUTS, OUTPUT> = async (
  _configurations,
  parameters,
): Promise<OUTPUT> => {
  console.log(`transcripting ${parameters.url}`);

  // Get transcription
  const transcript = await YoutubeTranscript.fetchTranscript(parameters.url, {
    lang: parameters.lang || 'en',
  });

  // Send to LLM to build a formatted response
  const message = `
    According to this transcription of a youtube video (which is in csv separated by ':::'):

    offset;text
    ${transcript.map((v) => `${Math.floor(v.offset)}:::${v.text}`).join('\n')}
    ---------------

    The video URL is ${parameters.url}

    ---------------

    Write a detailed summary divided in sections along the video.
    Format the answer using markdown.
    Add markdown links referencing every section using this format https://www.youtube.com/watch?v={video_id}&t={offset} where 'offset' is a number and can be obtained from the transcription in csv format to generate the URL
  `;
  const response = await shinkaiLlmPromptProcessor({ format: 'text', prompt: message })
  return { summary: response.message, transcript }
};
