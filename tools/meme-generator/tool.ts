import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';
import { getHomePath, getAssetPaths } from './shinkai-local-support.ts';

import axios from 'npm:axios';
import * as path from "jsr:@std/path";

export async function searchPerplexity(prompt: string, apiKey: string): Promise<string> {


  const payload = {
    model: "sonar",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    return_related_questions: false,
    web_search_options: {
      search_context_size: "medium",
    },
    stream: false,
    return_images: false,
  };

  try {
    console.log('[PERPLEXITY] Sending request to Perplexity API...');
    const response = await axios<{
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }>({
      url: "https://api.perplexity.ai/chat/completions",
      method: "POST",
      data: payload,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Perplexity API Error:", error);
    throw new Error("Failed to get response from Perplexity API");
  }
}

interface Configurations {
  IMGFLIP_USERNAME: string;
  IMGFLIP_PASSWORD: string;
  PERPLEXITY_API_KEY: string;
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


async function getMeme(meme: { name: string, box_count: number }, PERPLEXITY_API_KEY: string): Promise<string> {

  if (!PERPLEXITY_API_KEY) {
    throw new Error("Missing PERPLEXITY_API_KEY environment variable");
  }

  const prompt = `
For this meme:
\`\`\`json
${JSON.stringify(meme)}
\`\`\`

Tell me about the meme:
0. Search for more context about the meme.
1. General context and how it's used.
2. What should go in each box (from the box_count)
3. Give some diverse examples of how it's used.
4. Finally give me a summary of the meme, about its meaning, what it's about and what it transmits.

Expected Output Format:
\`\`\`markdown
# Name: Drake Hotline Bling
## General Context:
...

## Usage:
* Box 1:
* Box 2:
...
* Box N:

## Examples:
* Example 1:
* Example 2:
* ...
* Example N:

## Summary:
...
...
\`\`\`
`;


  const result = await searchPerplexity(prompt, PERPLEXITY_API_KEY);
  return result;
}

const getFile = async (filename: string): Promise<string> => {
  const asset_database = await getAssetPaths();
  const home_path = await getHomePath();

  const filePath = path.join(home_path, `${filename}.md`);
  const exists = await checkIfExists(filePath);

  if (exists) {
    return await Deno.readTextFile(filePath);
  }

  const assetExists = asset_database.find((a: string) => {
    const parts = a.split('/');
    const assetName = parts[parts.length - 1];
    return assetName === `${filename}.md`;
  })

  if (assetExists) {
    const exists = await checkIfExists(assetExists);
    if (exists) {
      return await Deno.readTextFile(assetExists);
    } else {
      console.log('[ERROR: File found, but not in path]', filename);
      return '';
    }
  }
  return '';
}

const transformName = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-");
}
let memes: MemeTemplate[] = [];
// Get popular meme templates from Imgflip API
async function getMemeTemplates(config: Configurations): Promise<{ id: string, name: string, description: string }[]> {
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
  const final_memes: { id: string, name: string, description: string }[] = [];

  for (const meme of memes) {
    const filename = transformName(meme.name);
    let memeData = await getFile(filename);
    // console.log('[MEME DATA]', filename, memeData.substring(0, 100));
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

    if (!memeData) {
      console.log(`[MEME GENERATOR] Meme ${meme.name} not found in local database, searching...`);
      if (!config.PERPLEXITY_API_KEY) {
        console.log("[SKIPPING] Missing PERPLEXITY_API_KEY environment variable. Skipping search.");
      } else {
        const home_path = await getHomePath();
        const filePath = path.join(home_path, `${filename}.md`);
        memeData = await getMeme({ name: meme.name, box_count: meme.box_count }, config.PERPLEXITY_API_KEY);
        Deno.writeFile(filePath, new TextEncoder().encode(memeData));
      }
    }

    if (memeData.trim()) {
      if (!memeData) throw new Error('Meme data not found');
      final_memes.push({
        id: meme.id,
        name: transformName(meme.name),
        description: memeData,
      });
    }

  }
  return final_memes;
}
// Select the best template based on joke content and template characteristics
async function selectTemplate(joke: string, templates: { id: string, name: string, description: string }[]): Promise<Record<`box + ${string}`, string> & { content: string, template_name: string, boxCount: number }> {
  let retries = 0;
  // list is too long, select random elements from it
  // Probability of 1.0 for the first element
  // And 0.0 for the last element
  const random_templates = [];
  for (let i = 0; i < templates.length; i++) {
    const probability = Math.random();
    if (probability < (1.0 - (i / templates.length))) {
      random_templates.push(templates[i]);
    }
  }


  const list = random_templates.map(m => m.name).join('\n');
  const descriptions = random_templates.map(m => `
    <template_description=${m.name}>
    ${m.description}
    </template_description=${m.name}>`).join('\n');
  const prompt = `
    ${descriptions}
    
    <rules>
    * template_description tags give an explanation of a each meme.
    * select the best possible template to use for the joke.
    * split the joke into box_count parts, and make it fit the template.
    * make it funny, irreverent, smart, and in context with the joke.
    * templates_names tag is a list of meme templates "names". 
    * output the selected template name and its box1, box2, boxN content.
    * the output must be a valid JSON object.
    * write no additional text or comments
    * use the example_output tag as a template for the output
    * keep the exact name of the template found in templates_names, as its a filename.
    </rules>
    
    <templates_names>
    ${list}
    </templates_names>
    
    <example_output>
    \`\`\`json
    {
      "template_name": "selected-template-name",
      "box1": "joke-part-1",
      "box2": "joke-part-2",
      "box3": "joke-part-3"
    }
    \`\`\`
    </example_output>
    
    <joke>
    ${joke}
    </joke>
    
    `;

  while (retries < 3) {

    const result = await shinkaiLlmPromptProcessor({ prompt, format: 'text' });
    console.log('[MEME GENERATOR] result:', result);

    const check = async (s: string): Promise<Record<`box + ${string}`, string> & { content: string, template_name: string, boxCount: number }> => {
      try {
        const json = JSON.parse(s);
        if (!json.template_name) {
          throw new Error('Invalid JSON');
        }
        // Let's get the file.
        const filename = transformName(json.template_name);
        const content = await getFile(filename);
        if (!content) {
          throw new Error('Meme data not found');
        }

        const boxCount = (() => {
          const boxes = content.match(/(Box \d+)/g);
          const set = new Set(boxes);
          const sorted = [...set].sort();
          const boxCount = parseInt(sorted[sorted.length - 1].replace(/Box /g, ""));
          return boxCount;
        })();

        for (let i = 0; i < boxCount; i++) {
          if (!json[`box${i + 1}`]) {
            throw new Error(`Box ${i + 1} not found`);
          }
        }

        return {
          ...json,
          content,
          boxCount,
        };
      } catch (error) {
        throw new Error('Failed to parse JSON');
      }
    }

    try {
      return await check(result.message);
    } catch (_) { }

    try {
      const result2 = result.message.replace(/^```json\n/, '').replace(/\n```$/, '');
      return await check(result2);
    } catch (_) { }

    console.log('[FAILED TO SELECT TEMPLATE], retrying...');
    console.log('[RESULT]', result.message);
    retries++;
  }
  throw new Error('Failed to select template');
}

export const run = async (
  configurations: Configurations,
  parameters: Parameters,
): Promise<Result> => {
  try {
    const templates = await getMemeTemplates(configurations);

    // Select best template based on joke content
    const selected_template = await selectTemplate(parameters.joke, templates);
    // console.log(`[MEME GENERATOR] Selected template: ${selected_template.template_name}`);
    const template = templates.find(t => transformName(t.name) === selected_template.template_name);
    if (!template) {
      throw new Error('Template not found');
    }

    const params = new URLSearchParams();
    params.append('template_id', template.id);
    params.append('username', configurations.IMGFLIP_USERNAME);
    params.append('password', configurations.IMGFLIP_PASSWORD);

    // Add boxes as form-urlencoded parameters
    for (let i = 0; i < selected_template.boxCount; i++) {
      const boxKey = `box${i + 1}` as keyof typeof selected_template;
      if (boxKey in selected_template) {
        params.append(`boxes[${i}][text]`, selected_template[boxKey] as string);
      }
    }

    const response = await axios.post('https://api.imgflip.com/caption_image', params);
    console.log('[MEME GENERATOR] Response from Imgflip API:', response.data);
    return { memeUrl: response.data.data.url };
  } catch (error) {
    if (error instanceof Error) {
      // console.log('[MEME GENERATOR]', error);
      throw new Error(`Failed to generate meme: ${error.message}`);
    }
    throw error;
  }
};
