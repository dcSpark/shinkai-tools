import { processToolsDirectory, saveToolsInNode } from "./save_tools.ts";
import { uploadTools } from "./upload.ts";

export async function start() {
  console.log("Starting tool processing...");
  console.log("Environment check:");
  console.log(`SHINKAI_STORE_ADDR: ${Deno.env.get("SHINKAI_STORE_ADDR")}`);
  console.log(`SHINKAI_NODE_ADDR: ${Deno.env.get("SHINKAI_NODE_ADDR")}`);
  console.log(`Store token present: ${!!Deno.env.get("SHINKAI_STORE_TOKEN")}`);
  console.log(`Bearer token present: ${!!Deno.env.get("BEARER_TOKEN")}`);
  
  // Run the script
  console.log("\nProcessing tools directory...");
  const tools_raw = await processToolsDirectory();
  console.log(`Found ${tools_raw.length} tools to process`);
  
  console.log("\nSaving tools to node and generating images...");
  const tools_saved = await saveToolsInNode(tools_raw);
  console.log(`Successfully processed ${tools_saved.length} tools`);
  
  console.log("\nUploading tools...");
  await uploadTools(tools_saved);
  console.log("Tool processing complete!");
}

if (import.meta.main) {
  start();
}
