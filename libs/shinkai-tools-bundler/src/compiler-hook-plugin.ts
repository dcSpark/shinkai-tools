import { Compiler, WebpackPluginInstance } from 'webpack';
import { writeFileSync } from 'fs';
import { join } from 'path';

type Options = {
  outputFolder: string;
  outputFilename: string;
  outputDefinitionFilename: string;
};

export class ToolDefinitionGeneratorPlugin implements WebpackPluginInstance {
  private options: Options;
  constructor(options: Options) {
    this.options = options;
  }
  apply(compiler: Compiler) {
    compiler.hooks.assetEmitted.tapAsync(
      'ToolDefinitionGeneratorPlugin',
      async (assetName, assetInfo, callback) => {
        const code = assetInfo.source.source();
        const definition = await eval(`
              ${code}
              var tool = new tool.Tool();
              tool.getDefinition();
            `);
        const extendedToolDefinition = {
          ...definition,
          code,
        };
        const definitionPath = join(
          this.options.outputFolder,
          this.options.outputDefinitionFilename,
        );
        writeFileSync(
          definitionPath,
          JSON.stringify(
            extendedToolDefinition,
            null,
            2,
          ),
        );
        console.log(
          `asset ${this.options.outputDefinitionFilename} emmited from ${assetName}`,
        );
        callback();
      },
    );
  }
}
