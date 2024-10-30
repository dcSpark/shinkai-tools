/**
 * Script to generate and inject Viem script content into a target file
 *
 * This script reads the Shinkai Viem library content, converts it to base64,
 * and injects it into a specified output file by replacing a placeholder comment.
 *
 * Usage:
 * Run with --targetfile parameter to specify the target file path
 * Example: deno run generate-shinkai-viem-export.ts --outfile=./output.ts
 */

import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import minimist from 'npm:minimist';
import { join } from 'node:path';
import process from 'node:process';

console.log('🚀 Starting Shinkai Viem attachment script...');

// Parse command line arguments
console.log('📝 Parsing command line arguments...');
const args = minimist(process.argv.slice(2));

// Path to the Shinkai Viem library
console.log('🔍 Locating Shinkai Viem library...');
const shinkaViemPath = path.join(
  Deno.cwd(),
  'dist/libs/shinkai-viem/shinkai-viem.js',
);
// Read the Viem library content
console.log('📖 Reading Viem library content...');
const shinkaiViemContent = fs.readFileSync(shinkaViemPath, 'utf-8');

// Get output file path from arguments
const outputFile: string = join(process.cwd(), args.targetfile);
console.log('📂 Target file:', outputFile);

// Create the content to inject with base64 encoded Viem script
console.log('🔄 Converting Viem content to base64...');
const outputContent = `// attach-viem-script-content
const viemScriptContent = "${Buffer.from(shinkaiViemContent).toString('base64')}";`;

// Read the target file content
console.log('📖 Reading target file content...');
const indexContent = fs.readFileSync(outputFile, 'utf-8');
// Replace the placeholder comment with the new content
console.log('✏️ Injecting Viem content into target file...');
const updatedIndexContent = indexContent.replace(
  /\/\/\s*attach-viem-script-content.*\n.*/,
  outputContent,
);

// Write the updated content back to the file
console.log('💾 Writing updated content back to file...');
fs.writeFileSync(outputFile, updatedIndexContent);

console.log('✅ Shinkai Viem attachment completed successfully!');
