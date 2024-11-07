import * as fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';

const destinationArg = Deno.args[0];
const singleAppBinaryName = process.platform === 'win32' ? 'deno.exe' : 'deno';
const destination = path.join(process.cwd(), destinationArg, singleAppBinaryName);
function bundle() {
  try {
    // Step: Copy the Deno executable to create our custom executable
    console.log('step: copying Deno executable...');
    const denoPath = Deno.execPath();
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(denoPath, destination);
    console.log('deno executable copied successfully.');
    console.log('bundling completed successfully.');
  } catch (error) {
    console.error('bundling failed:', error);
    process.exit(1);
  }
}

// Execute the bundling process
console.log('initiating bundling process...');
bundle();
