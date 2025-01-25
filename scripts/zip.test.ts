import { assertEquals } from "jsr:@std/assert";
import { getMetadata, processToolsDirectory, saveToolsInNode } from "./build_tools/save_tools.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";
import { stripVersion, systemTools } from "./build_tools/system.ts";
import { memoryTest } from "./tests/tool-memory.test.ts";

Deno.test("Check if related tools exist", async () => {
  const tools_raw = await processToolsDirectory();
  const metadatas = await getMetadata(tools_raw);
  const tool_key_list = [
    ...systemTools,
    ...metadatas.map(tool => tool.key),
  ];
  for (const tool of metadatas) {
    if (!tool.metadata.tools) continue;
    console.log(`Testing tool ${tool.name}`);
    const expectedTools = tool.metadata.tools.map(t => stripVersion(t));
    const actualTools = expectedTools.filter(tool => tool_key_list.includes(tool));
    assertEquals(expectedTools.length, actualTools.length, `Tool ${tool.name}. Expected:\n${expectedTools.join("\n")}\nActual:\n${actualTools.join("\n")}`);
  }
});

Deno.test("Compare shinkai-node generated ZIP __tool.json vs .tool-dump.test.json", async () => {
  const tools_raw = await processToolsDirectory();
  const tools_saved = await saveToolsInNode(tools_raw);

  // Expect the number of tools saved to be the same as the number of tools raw
  assertEquals(tools_saved.map(tool => tool.name).sort(), tools_raw.map(tool => tool.name).sort());
  
  // Search for tools with .tool-dump.test.json
  for await (const entryx of Deno.readDir("tools")) {
    if (!entryx.isDirectory) continue;
    const toolDir = join("tools", entryx.name);
    const toolDump = await exists(join(toolDir, ".tool-dump.test.json"));
    if (!toolDump) {
      console.log(`[SKIPING] Tool ${entryx.name} does not have a .tool-dump.test.json`);
      continue;
    } else {
      console.log(`[TESTING] Tool ${entryx.name}`);
    }
    const metadata = JSON.parse(await Deno.readTextFile(join(toolDir, "metadata.json")));

    // Search for tool downloaded and extracted data
    const zipDir = join("packages", metadata.name.toLowerCase().replace(/[^a-z0-9_.-]/g, '_'));
    const zipDirExists = await exists(zipDir);
    assertEquals(zipDirExists, true, 'zip dir exists');
    const zipTool = await exists(join(zipDir, "__tool.json"));
    assertEquals(zipTool, true, 'zip tool exists');

    // read zipTool and toolDump and compare
    const zipToolData = JSON.parse(await Deno.readTextFile(join(zipDir, "__tool.json")));
    const toolDumpData = JSON.parse(await Deno.readTextFile(join(toolDir, ".tool-dump.test.json")));
    // Embeddings might change.
    zipToolData.content[0].embedding = [];
    toolDumpData.content[0].embedding = [];
    assertEquals(zipToolData, toolDumpData);
  }
    
});


Deno.test("Check if memory is working", async () => {
  await memoryTest();
});
