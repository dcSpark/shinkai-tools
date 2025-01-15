import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';
import { getHomePath } from './shinkai-local-support.ts';
import axios from 'npm:axios';

type Run<C, P, R> = (configurations: C, parameters: P) => Promise<R>;

interface Configurations {
  username: string;
  password: string;
}

interface Parameters {
  joke: string;
}

interface Result {
  memeUrl: string;
}

interface MemeTemplate {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
}

// Split joke into two parts intelligently
async function splitJoke(joke: string, parts: number = 2): Promise<[string, string]> {
    let retries = 0;
    while (retries < 3) {
    const result = await shinkaiLlmPromptProcessor({ prompt: `
<rules>
* split the joke into ${parts} lines, so its writable in a meme image.
* write no additional text or comments
* output EXACTLY JUST the EXACT text and nothing else, any other data will make the output invalid
</rules>

<joke>
${joke}
</joke>
`});
    console.log('Joke split', result);
    const split_parts = result.message.split('\n');
    if (split_parts.length !== parts) {
      retries++;
      continue;
    }
    return split_parts;
  }
  throw new Error('Failed to split joke');
}

let memes: MemeTemplate[] = [];
// Get popular meme templates from Imgflip API
async function getMemeTemplates(): Promise<MemeTemplate[]> {
  if (memes.length > 0) {
    return memes;
  }
  const response = await fetch('https://api.imgflip.com/get_memes');
  console.log('Fetching meme templates...');
  const data = await response.json();
  if (!data.success) {
    throw new Error('Failed to fetch meme templates');
  }
  memes = data.data.memes;
  return memes;
}

// Select the best template based on joke content and template characteristics
async function selectTemplate(joke: string): Promise<MemeTemplate> {
  let retries = 0;
  while (retries < 3) {
    const templates = await getMemeTemplates();
    const list = templates.map(m => m.name).join('\n');
    const result = await shinkaiLlmPromptProcessor({ prompt: `
<rules>
* templates tag is a list of meme templates names. 
* write no additional text or comments
* output EXACTLY JUST the EXACT line and nothing else, any other data will make the output invalid
* output the line that matches best the joke tag
</rules>

<templates>
${list}
</templates>

<joke>
${joke}
</joke>

`});
    const meme = templates.find(m => m.name.toLowerCase().match(result.message.toLowerCase()))
    if (meme) {
      console.log('Selected Template:', result);
      return meme;
    }
    retries++;
  }
  throw new Error('Failed to select template');
}

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  try {
    // Select best template based on joke content
    const template = await selectTemplate(parameters.joke);
    console.log(`Selected template: ${template.name}`);
    // Split the joke into two parts
    const parts = await splitJoke(parameters.joke);

    const params = new URLSearchParams();
    params.append('template_id', template.id);
    params.append('username', configurations.username);
    params.append('password', configurations.password);
    for (let i = 0; i < parts.length; i += 1) {
      params.append('text' + i, parts[i]);
    }
    console.log('Sending request to Imgflip API...');
    const response = await axios.post('https://api.imgflip.com/caption_image', params);
    console.log('Response from Imgflip API:', response.data);
    return { memeUrl: response.data.data.url };
  } catch (error) {
    if (error instanceof Error) {
      console.log(error);
      throw new Error(`Failed to generate meme: ${error.message}`);
    }
    throw error;
  }
};
