import { config as dotenvConfig } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.210.0/path/mod.ts";
import { existsSync } from "https://deno.land/std@0.210.0/fs/mod.ts";
import axios from "npm:axios@1.6.2";

// Load environment variables
dotenvConfig();
const BFL_API_URL = 'https://api.us1.bfl.ai/v1';
const BFL_API_KEY = Deno.env.get("BFL_API_KEY");

interface ToolMetadata {
  name: string;
  description: string;
}

interface AgentMetadata {
  name: string;
  ui_description: string;
}

interface GenerateImageOptions {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_outputs?: number;
  guidance_scale?: number;
  seed?: number;
}

interface BFLResponse {
  id: string;
  status: string;
  result?: {
    sample: string;
  };
}

async function readToolMetadata(toolPath: string): Promise<ToolMetadata> {
  const metadataPath = join(toolPath, 'metadata.json');
  const metadata = JSON.parse(await Deno.readTextFile(metadataPath));
  return metadata;
}

async function waitForImageGeneration(requestId: string): Promise<string> {
  while (true) {
    const response = await axios.get<BFLResponse>(`${BFL_API_URL}/get_result?id=${requestId}`, {
      headers: {
        'accept': 'application/json',
        'x-key': BFL_API_KEY
      }
    });

    if (response.data.status === 'Ready' && response.data.result) {
      return response.data.result.sample;
    }

    if (response.data.status === 'Failed') {
      throw new Error('Image generation failed');
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function generateImage(options: GenerateImageOptions): Promise<string> {
  const defaultOptions = {
    width: 1024,
    height: 1024,
    // prompt_upsampling: true,
  };

  if (!options.prompt) {
    throw new Error('Prompt is required');
  }

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    // Initial request to start generation
    const response = await axios.post<BFLResponse>(
      `${BFL_API_URL}/flux-pro-1.1`,
      {
        prompt: mergedOptions.prompt,
        width: mergedOptions.width,
        height: mergedOptions.height
      },
      {
        headers: {
          'accept': 'application/json',
          'x-key': BFL_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // Poll for results
    return await waitForImageGeneration(response.data.id);
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

async function copyPlaceholderImages(scriptDir: string, toolPath: string, missingFiles: string[]): Promise<void> {
  console.log("Using placeholder images for:", missingFiles.join(", "));
  for (const file of missingFiles) {
    const sourcePath = join(scriptDir, file);
    const destPath = join(toolPath, file);
    if (existsSync(sourcePath)) {
      await Deno.copyFile(sourcePath, destPath);
    }
  }
}

async function generateToolImages(toolPath: string, rawMetadata: ToolMetadata | AgentMetadata): Promise<void> {
  const bannerPath = join(toolPath, 'banner_background.png');
  const iconPath = join(toolPath, 'icon.png');
  const missingFiles: string[] = [];

  if (!existsSync(bannerPath)) missingFiles.push('banner_background.png');
  if (!existsSync(iconPath)) missingFiles.push('icon.png');

  if (!missingFiles.length) {
    console.log("All images already exist, skipping generation");
    return;
  }

  console.log(`Generating missing images: ${missingFiles.join(', ')}`);


  let metadata: ToolMetadata;

  if ('name' in rawMetadata && 'description' in rawMetadata) {
    metadata = rawMetadata as ToolMetadata;
  } else {
    metadata = {
      name: rawMetadata.name,
      description: rawMetadata.ui_description
    } as ToolMetadata;
  }

  try {
    if (missingFiles.includes('banner_background.png')) {
      const bannerPrompt =
        `Create a professional banner image for a software tool named '${metadata.name}'. ` +
        `The tool description is: ${metadata.description}. Use a modern, minimalist style with subtle tech elements. ` +
        "Make it suitable for a developer tool interface. Use a cohesive color scheme, dark colors, allowing for white text to be readable on the image. " +
        "and include some abstract geometric elements that represent the tool's function." +
        "Do not include any text, just create a beautiful image. And I repeat, do not include any text.";

      console.log(`Generating banner for ${metadata.name}...`);
      const bannerUrl = await generateImage({
        prompt: bannerPrompt,
        width: 1280,
        height: 736,
        num_outputs: 1
      });

      const response = await axios.get(bannerUrl, { responseType: 'arraybuffer' });
      await Deno.writeFile(join(toolPath, 'banner_background.png'), new Uint8Array(response.data));
    }

    if (missingFiles.includes('icon.png')) {
      const iconPrompt =
        `Create a simple, memorable icon for '${metadata.name}'. The icon should represent the tool's function, which is: ` +
        `${metadata.description}. Use a minimal design with clear shapes and limited colors. ` +
        "Make it recognizable at small sizes and suitable for a developer tool. " +
        "The icon should work well as an app icon or menu item.";

      console.log(`Generating icon for ${metadata.name}...`);
      const iconUrl = await generateImage({
        prompt: iconPrompt,
        width: 256,
        height: 256,
        num_outputs: 1
      });

      const response = await axios.get(iconUrl, { responseType: 'arraybuffer' });
      await Deno.writeFile(join(toolPath, 'icon.png'), new Uint8Array(response.data));
    }

    console.log("Successfully generated missing images");
  } catch (error) {
    console.error('Error generating images:', error);
    throw error;
  }
}

async function main() {
  if (!BFL_API_KEY) {
    console.error('Please set BFL_API_KEY environment variable');
    Deno.exit(1);
  }

  let __dirname: string;
  if (!Deno.env.get("DIR_NAME")) {
    __dirname = dirname(fromFileUrl(import.meta.url));
  } else {
    __dirname = Deno.env.get("DIR_NAME") as string;
  }

  const toolsDir = join(__dirname, '..', 'tools');
  const agentsDir = join(__dirname, '..', 'agents');
  const scriptDir = __dirname;

  // Get all tool directories
  const tools = Array.from(Deno.readDirSync(toolsDir))
    .filter(item => item.isDirectory)
    .map(item => item.name);

  const agents = Array.from(Deno.readDirSync(agentsDir))
    .filter(item => item.isDirectory)
    .map(item => item.name);

  console.log(`Processing ${tools.length} tools and ${agents.length} agents`);

  async function process(toolPath: string, tool: string) {
    try {
      const metadata = await readToolMetadata(toolPath);
      await generateToolImages(toolPath, metadata);
    } catch (error) {
      console.error(`Error processing tool ${tool}:`, error);
      // Copy placeholder images if available
      const missingFiles = [];
      if (!existsSync(join(toolPath, 'banner_background.png'))) missingFiles.push('banner_background.png');
      if (!existsSync(join(toolPath, 'icon.png'))) missingFiles.push('icon.png');
      if (missingFiles.length) {
        await copyPlaceholderImages(scriptDir, toolPath, missingFiles);
      }
    }
  }

  await Promise.all(tools.map(tool => process(join(toolsDir, tool), tool)));
  await Promise.all(agents.map(agent => process(join(agentsDir, agent), agent)));
}

// Run if called directly
if (import.meta.main) {
  main().catch(error => {
    console.error('Fatal error:', error);
    Deno.exit(1);
  });
}

export { generateImage };
export type { GenerateImageOptions };
