import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';
import { smartSearchEngine } from './shinkai-local-tools.ts';
import { getHomePath, getAssetPaths } from './shinkai-local-support.ts';
import axios from 'npm:axios';
import * as path from "jsr:@std/path";

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
  description: string;
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
    console.log('[MEME GENERATOR] Joke parts', result);
    const split_parts = result.message.split('\n');
    if (split_parts.length !== parts) {
      retries++;
      continue;
    }
    return split_parts;
  }
  throw new Error('Failed to split joke');
}

const checkIfExists = async (path: string) => {
  try {
    await Deno.lstat(path);
    return true;
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
    return false;
  }
}

let memes: MemeTemplate[] = [];
// Get popular meme templates from Imgflip API
async function getMemeTemplates(): Promise<MemeTemplate[]> {
  if (memes.length > 0) {
    return memes;
  }
  const response = await fetch('https://api.imgflip.com/get_memes');
  const data = await response.json();
  if (!data.success) {
    throw new Error('Failed to fetch meme templates');
  }
  memes = data.data.memes;

  // We search for the meme in the local database, or else we do a smart search and create the new entry
  const final_memes: MemeTemplate[] = [];
  const asset_database = await getAssetPaths();
  const home_path = await getHomePath();

  for (const meme of memes) {
    const name = meme.name.replace("/", "_").replace(",", "_");
    const name_encoded = encodeURIComponent(name);
    
    /**
     * We check if the meme is already in the asset database
     * Names are URL encoded when stored in the asset folder.
     * 
     * If not found, we search for it in the local database
     * Names are not URL encoded when stored in the local database.
     * 
     * If not found, we search for it in the smart search engine
     * And we store the result in the local database
     */
    const assetExists = asset_database.find(a => {
      const parts = a.split('/');
      const file_name = parts[parts.length - 1];
      return file_name === `${name_encoded}.json` || file_name === `${name}.json`;
    })

    const filePath = path.join(home_path, `${name}.json`);
    const exists = await checkIfExists(filePath);
    
    let memeData = '';
    if (exists) {
      memeData = await Deno.readTextFile(filePath);
    }
    else if (assetExists) {
      memeData = await Deno.readTextFile(assetExists);    
    }
    else {
      console.log(`[MEME GENERATOR] Meme ${meme.name} not found in local database, searching...`);
      const memeData = await smartSearchEngine({ question: `Describe this meme, and how its used: '${meme.name}'`});
      Deno.writeFile(filePath, new TextEncoder().encode(memeData.response));
    } 
    
    final_memes.push({
      ...meme,
      description: memeData,
    });
  }
  
  return final_memes;
}

// Select the best template based on joke content and template characteristics
async function selectTemplate(joke: string): Promise<MemeTemplate> {
  let retries = 0;
  while (retries < 3) {
    const templates = await getMemeTemplates();
    const list = templates.map(m => m.name).join('\
');

    const descriptions = templates.map(m => `
<template_description=${m.name}>
${m.description}
</template_description=${m.name}>`).join('\
');
    const prompt = `
${descriptions}

<rules>
* templates tag is a list of meme templates names. 
* write no additional text or comments
* output EXACTLY JUST the EXACT template line and nothing else, any other data will make the output invalid
* output the line that matches best the joke tag
</rules>

<templates>
${list}
</templates>

<joke>
${joke}
</joke>

`;
    const result = await shinkaiLlmPromptProcessor({ prompt, format: 'text' });
    console.log('[MEME GENERATOR] prompt', prompt);
    console.log('[MEME GENERATOR] result:', result);
    const meme = templates.find(m => m.name.toLowerCase().match(result.message.toLowerCase()))
    if (meme) {
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
    console.log(`[MEME GENERATOR] Selected template: ${template.name}`);
    // Split the joke into two parts
    const parts = await splitJoke(parameters.joke);

    const params = new URLSearchParams();
    params.append('template_id', template.id);
    params.append('username', configurations.username);
    params.append('password', configurations.password);
    for (let i = 0; i < parts.length; i += 1) {
      params.append('text' + i, parts[i]);
    }
    console.log('[MEME GENERATOR] Sending request to Imgflip API...');
    const response = await axios.post('https://api.imgflip.com/caption_image', params);
    console.log('[MEME GENERATOR] Response from Imgflip API:', response.data);
    return { memeUrl: response.data.data.url };
  } catch (error) {
    if (error instanceof Error) {
      console.log('[MEME GENERATOR]', error);
      throw new Error(`Failed to generate meme: ${error.message}`);
    }
    throw error;
  }
};
