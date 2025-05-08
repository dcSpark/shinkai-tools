import { processAgentsDirectory, processToolsDirectory, saveAgentsInNode, saveToolsInNode } from "./save_tools.ts";
import { uploadTools } from "./upload.ts";

export async function start() {
  console.log("Starting tool processing...");
  console.log("Environment check:");
  console.log(`SHINKAI_STORE_ADDR: ${Deno.env.get("SHINKAI_STORE_ADDR")}`);
  console.log(`SHINKAI_NODE_ADDR: ${Deno.env.get("SHINKAI_NODE_ADDR")}`);
  console.log(`Store token present: ${!!Deno.env.get("SHINKAI_STORE_TOKEN")}`);
  console.log(`Bearer token present: ${!!Deno.env.get("BEARER_TOKEN")}`);

  // Process tools
  console.log("\nProcessing tools directory...");
  const tools_raw = await processToolsDirectory();
  console.log(`Found ${tools_raw.length} tools to process`);

  console.log("\nSaving tools to node and generating zip files...");
  const tools_saved = await saveToolsInNode(tools_raw);
  console.log(`Successfully processed ${tools_saved.length} tools`);

  console.log("\nUploading tools to Shinkai Store...");
  await uploadTools(tools_saved);
  console.log("Tool uploading complete!");

  // Process agents
  console.log("\nProcessing agents directory...");
  const agents_raw = await processAgentsDirectory();
  console.log(`Found ${agents_raw.length} agents to process`);

  console.log("\nSaving agents to node and generating zip files...");
  const agents_saved = await saveAgentsInNode(agents_raw);
  console.log(`Successfully processed ${agents_saved.length} agents`);

  console.log("\nUploading agents to Shinkai Store...");
  await uploadTools(agents_saved);
  console.log("Agent uploading complete!");
}

if (import.meta.main) {
  start();
}
