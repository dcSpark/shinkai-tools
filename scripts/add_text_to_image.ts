import { Image, TextLayout } from "https://deno.land/x/imagescript@1.2.15/mod.ts";
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.210.0/path/mod.ts";
import { existsSync } from "https://deno.land/std@0.210.0/fs/mod.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));
const toolsDir = join(__dirname, '..', 'tools');
const fontPath = join(__dirname, 'Lato-Bold.ttf');

async function addTextToImage(inputPath: string, outputPath: string, toolName: string): Promise<void> {
  try {
    // Load the background image
    const image = await Image.decode(await Deno.readFile(inputPath));
    const width = image.width;
    const height = image.height;
    
    // Calculate font size (start with 10% of height)
    const fontSize = Math.floor(height * 0.10);
    console.log(`Image dimensions: ${width}x${height}, fontSize: ${fontSize}`);
    
    // Load font
    const font = await Deno.readFile(fontPath);
    
    // Create text layout
    const layout = new TextLayout({
      maxWidth: Math.floor(width * 0.9),
      maxHeight: Math.floor(height * 0.9),
      wrapStyle: "word",
      align: "center"
    });
    
    // Create shadow text
    const shadowText = Image.renderText(font, fontSize, toolName, 0x000000FF, layout);
    
    // Calculate center position
    let x = Math.floor((width - shadowText.width) / 2);
    let y = Math.floor((height - shadowText.height) / 2);
    console.log(`Text position: (${x},${y})`);
    
    // Ensure we don't go beyond image boundaries
    const minPadding = Math.floor(height * 0.05); // 5% of height as minimum padding
    if (x < minPadding) x = minPadding;
    if (y < minPadding) y = minPadding;
    if (x + shadowText.width > width - minPadding) x = width - shadowText.width - minPadding;
    if (y + shadowText.height > height - minPadding) y = height - shadowText.height - minPadding;
    
    // Draw shadow with multiple offsets for thickness
    for (let offsetX = 1; offsetX <= 4; offsetX++) {
      for (let offsetY = 1; offsetY <= 4; offsetY++) {
        await image.composite(shadowText, x + offsetX, y + offsetY);
      }
    }
    
    // Create and draw main text
    const mainText = Image.renderText(font, fontSize, toolName, 0xFFFFFFFF, layout);
    await image.composite(mainText, x, y);
    
    // Save the result
    await Deno.writeFile(outputPath, await image.encode());
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error);
    throw error;
  }
}

async function readToolMetadata(toolPath: string) {
  const metadataPath = join(toolPath, 'store.json');
  const metadata = JSON.parse(await Deno.readTextFile(metadataPath));
  return metadata;
}

async function main() {
  // Get all tool directories
  const tools = Array.from(Deno.readDirSync(toolsDir))
    .filter(item => item.isDirectory)
    .map(item => item.name);  

  for (const tool of tools) {
    const toolPath = join(toolsDir, tool);
    const backgroundPath = join(toolPath, 'banner_background.png');
    const bannerPath = join(toolPath, 'banner.png');
    
    // Skip if background doesn't exist
    if (!existsSync(backgroundPath)) {
      console.log(`Skipping ${tool}: no banner_background.png found`);
      continue;
    }

    try {
      console.log(`Processing ${tool}...`);
      const metadata = await readToolMetadata(toolPath);
      await addTextToImage(backgroundPath, bannerPath, metadata.name);
      console.log(`Successfully generated banner.png for ${tool}`);
    } catch (error) {
      console.error(`Error processing tool ${tool}:`, error);
    }
  }
}

// Run if called directly
if (import.meta.main) {
  main().catch(error => {
    console.error('Fatal error:', error);
    Deno.exit(1);
  });
}