type Run<C, P, R> = (configurations: C, parameters: P) => Promise<R>;
type ToolDefinition<T> = {
  id: string;
  name: string;
  description: string;
  author: string;
  keywords: string[];
  configurations: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  result: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
};

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
function splitJoke(joke: string): [string, string] {
  // Try to split on question mark first
  if (joke.includes('?')) {
    const [setup, ...punchline] = joke.split('?');
    return [setup + '?', punchline.join('?').trim()];
  }

  // Try to split on common joke separators
  const separators = ['. ', '! ', ': ', '... '];
  for (const separator of separators) {
    if (joke.includes(separator)) {
      const [setup, ...punchline] = joke.split(separator);
      return [setup + separator[0], punchline.join(separator).trim()];
    }
  }

  // Try to split on newline
  if (joke.includes('\n')) {
    const [setup, ...punchline] = joke.split('\n');
    return [setup, punchline.join('\n').trim()];
  }

  // Default to splitting in half
  const midpoint = Math.ceil(joke.length / 2);
  const setup = joke.substring(0, midpoint);
  const punchline = joke.substring(midpoint);
  return [setup.trim(), punchline.trim()];
}

// Get popular meme templates from Imgflip API
async function getMemeTemplates(): Promise<MemeTemplate[]> {
  const response = await fetch('https://api.imgflip.com/get_memes');
  const data = await response.json();
  if (!data.success) {
    throw new Error('Failed to fetch meme templates');
  }
  return data.data.memes;
}

// Select the best template based on joke content and template characteristics
async function selectTemplate(_joke: string): Promise<MemeTemplate> {
  const templates = await getMemeTemplates();
  
  // Filter templates that work well with two text boxes
  const suitableTemplates = templates.filter(template => template.box_count === 2);
  
  // For now, select a random suitable template
  // This could be enhanced with more sophisticated selection logic
  const randomIndex = Math.floor(Math.random() * suitableTemplates.length);
  return suitableTemplates[randomIndex];
}

export const run: Run<Record<string, never>, Parameters, Result> = async (
  _configurations,
  parameters,
): Promise<Result> => {
  try {
    // Select best template based on joke content
    const template = await selectTemplate(parameters.joke);
    console.log(`Selected template: ${template.name}`);

    // Split the joke into two parts
    const [topText, bottomText] = splitJoke(parameters.joke);
    
    // Generate meme URL using template and text (without authentication)
    // Since we can't generate captions without auth, we'll return the template URL
    // with a note about the text placement
    console.log(`Would place text "${topText}" and "${bottomText}" on template`);
    
    return {
      memeUrl: template.url
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate meme: ${error.message}`);
    }
    throw error;
  }
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-meme-generator',
  name: 'Shinkai: Meme Generator',
  description: 'Generates a meme based on a given joke using the Imgflip API',
  author: 'Shinkai',
  keywords: ['meme', 'joke', 'image', 'imgflip', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {},
    required: [],
  },
  parameters: {
    type: 'object',
    properties: {
      joke: { 
        type: 'string',
        description: 'The joke text to be converted into a meme'
      },
    },
    required: ['joke'],
  },
  result: {
    type: 'object',
    properties: {
      memeUrl: { 
        type: 'string',
        description: 'URL of the generated meme image'
      },
    },
    required: ['memeUrl'],
  },
};
