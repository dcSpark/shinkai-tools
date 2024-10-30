/**
 * Script to bundle Shinkai Viem library using esbuild
 * 
 * This script takes an entry file and output file path as arguments and bundles
 * the Shinkai Viem library code using esbuild. It includes Deno compatibility
 * through the esbuild-deno-loader plugin.
 * 
 * Usage:
 * Run with --entry and --outfile parameters:
 * deno run shinkai-viem-bundler.ts --entry=<entry-file> --outfile=<output-file>
 * 
 * Example:
 * deno run shinkai-viem-bundler.ts --entry=libs/shinkai-viem/src/index.ts --outfile=dist/libs/shinkai-viem/shinkai-viem.js
 */

import { join } from 'node:path';
import minimist from 'npm:minimist';
import fs from 'node:fs';
import process from 'node:process';
import { build } from 'npm:esbuild';
import { denoPlugins } from 'jsr:@luca/esbuild-deno-loader@^0.11.0';

console.log('🚀 Starting Shinkai Viem bundler...');

// Parse command line arguments
console.log('📝 Parsing command line arguments...');
const args = minimist(process.argv.slice(2));
const entryFile: string = join(process.cwd(), args.entry);
const outputFile: string = join(process.cwd(), args.outfile);

// Log file paths for debugging
console.log('📂 Entry file:', entryFile);
console.log('📂 Output file:', outputFile);

// Build configuration using esbuild
console.log('🔨 Starting esbuild bundling process...');
build({
  entryPoints: [entryFile],
  bundle: true,
  platform: 'browser', // Target browser platform
  target: 'deno2.0.3', // Target Deno version
  outfile: outputFile,
  plugins: [...denoPlugins()], // Enable Deno compatibility
})
  .then(async () => {
    console.log('📦 Bundle created successfully');
    // Read and write the bundled code
    console.log('📝 Reading bundled code...');
    const code = await fs.promises.readFile(outputFile, 'utf-8');
    console.log('💾 Writing bundled code to output file...');
    await fs.promises.writeFile(outputFile, code);
    console.log('✅ Bundle process completed successfully!');
  })
  .catch((e) => {
    // Handle build errors
    console.log('❌ Build error:', e);
    process.exit(1);
  });
