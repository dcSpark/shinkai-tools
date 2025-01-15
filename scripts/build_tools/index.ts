import { processToolsDirectory, saveToolsInNode } from "./save_tools.ts";
import { uploadTools } from "./upload.ts";

export async function start() {
  // Run the script
  const tools_raw = await processToolsDirectory();
  const tools_saved = await saveToolsInNode(tools_raw);
  await uploadTools(tools_saved);
}

if (import.meta.main) {
  start();
}
