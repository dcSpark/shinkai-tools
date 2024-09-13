import { build } from 'esbuild';
import { join } from 'path';
import minimist from 'minimist';
import fs from 'fs';
import axios from 'axios';

const args = minimist(process.argv.slice(2));
const entryFile: string = args.entry;
const outputFolder: string = args.outputFolder || join(__dirname);
const outputFile: string = join(outputFolder, 'index.js');

async function getEmbeddings(prompt: string): Promise<number[]> {
  const apiUrl = process.env.EMBEDDING_API_URL || 'http://localhost:11434';
  const response = await axios.post(`${apiUrl}/api/embeddings`, {
    model: 'snowflake-arctic-embed:xs',
    prompt,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to fetch embeddings: ${response.statusText}`);
  }

  return response.data.embedding;
}

build({
  entryPoints: [entryFile],
  bundle: true,
  platform: 'node',
  target: 'node20.16',
  outfile: outputFile,
})
  .then(async () => {
    const code = await fs.promises.readFile(outputFile, 'utf-8');
    const definition = await eval(
      ` ${code} var tool = new Tool(); tool.getDefinition(); `,
    );

    // Extract NAME and DESCRIPTION
    const name = definition.name;
    const description = definition.description;
    const prompt = `${name} ${description}`;

    // Get embeddings
    const embeddings = await getEmbeddings(prompt);

    // Add embedding metadata
    const extendedToolDefinition = {
      ...definition,
      code,
      embedding_metadata: {
        model_name: 'snowflake-arctic-embed:xs', // Replace with your actual model name
        embeddings,
      },
    };

    const definitionPath = join(outputFolder, 'definition.json');
    await fs.promises.writeFile(
      definitionPath,
      JSON.stringify(extendedToolDefinition, null, 2),
    );

    console.log(`Asset definition.json emitted from ${outputFile}`);
  })
  .catch((e) => {
    console.log('error', e);
    process.exit(1);
  });
