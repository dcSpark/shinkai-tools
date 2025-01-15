import { assertEquals } from "jsr:@std/assert";
import { processToolsDirectory, saveToolsInNode } from "./build_tools/save_tools.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

Deno.test("Compare shinkai-node generated ZIP __tool.json vs .tool-dump.test.json", async () => {
  const tools_raw = await processToolsDirectory();
  const tools_saved = await saveToolsInNode(tools_raw);

  // Expect the number of tools saved to be the same as the number of tools raw
  assertEquals(tools_saved.map(tool => tool.name).sort(), tools_raw.map(tool => tool.name).sort());
  
  // Search for tools with .tool-dump.test.json
  for await (const entry of Deno.readDir("tools")) {
    if (!entry.isDirectory) continue;

    const toolDir = join("tools", entry.name);
    const toolDump = await exists(join(toolDir, ".tool-dump.test.json"));
    if (!toolDump) {
      console.log(`[SKIPING] Tool ${entry.name} does not have a .tool-dump.test.json`);
      continue;
    }

    // Search for tool downloaded and extracted data
    const zipDir = join("packages", `${entry.name}`);
    const zipDirExists = await exists(zipDir);
    assertEquals(zipDirExists, true);
    const zipTool = await exists(join(zipDir, "__tool.json"));
    assertEquals(zipTool, true);

    // read zipTool and toolDump and compare
    const zipToolData = JSON.parse(await Deno.readTextFile(join(zipDir, "__tool.json")));
    const toolDumpData = JSON.parse(await Deno.readTextFile(join(toolDir, ".tool-dump.test.json")));
    // Embeddings might change.
    zipToolData.content[0].embedding = [];
    toolDumpData.content[0].embedding = [];
    assertEquals(zipToolData, toolDumpData);
  }
    
});


