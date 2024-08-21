import { build } from 'esbuild';
import { join } from 'path';
import minimist from 'minimist';
import fs from 'fs';

const args = minimist(process.argv.slice(2));
const entryFile: string = args.entry;
const outputFolder: string = args.outputFolder || join(__dirname);
const outputFile: string = join(outputFolder, 'index.js');
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
    const extendedToolDefinition = { ...definition, code };
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
