import { DirectoryEntry, Metadata, StoreMetadata } from "./interfaces.ts";
import { join } from "@std/path";
import { exists } from "@std/fs";
import { encodeBase64 } from "@std/encoding/base64";


interface Tool {
  dir: string;
  name: string;
  routerKey: string;
}
import { generateToolRouterKey, systemTools, stripVersion, author, uploadAsset } from "./system.ts";
import { getCategories } from "./fetch_categories.ts";

// deno-lint-ignore require-await
async function getToolType(file: string): Promise<string> {
  return file.endsWith(".ts") ? "Deno" : "Python";
}

async function calculateBlake3Hash(filePath: string): Promise<string> {
  const command = new Deno.Command("b3sum", {
    args: [filePath],
  });
  const { stdout } = await command.output();
  const output = new TextDecoder().decode(stdout);
  return output.split(" ")[0];
}

// deno-lint-ignore require-await
async function buildToolJson(
  toolContent: string, 
  metadata: Metadata, 
  toolType: string, 
  assets: { file_name: string, data: string }[] | undefined,
  tool: Tool)
{
  // Set GENERATE_RANDOM_NAME to true to generate a random name for the tool
  // So multiple tools with the same name can be uploaded into the node.
  const generate_random_name = !!Deno.env.get("GENERATE_RANDOM_NAME");
  // Always use metadata.name for router key generation to maintain compatibility
  const routerKeyName = metadata.name;
  
  // For display name, try to use store.json name if available
  let displayName = metadata.name;
  try {
    const storeMetadata = JSON.parse(await Deno.readTextFile(join(tool.dir, "store.json")));
    if (storeMetadata.name) {
      displayName = storeMetadata.name;
    }
  } catch (e) {
    // If store.json doesn't exist or doesn't have a name field, use metadata.name
  }
  if (generate_random_name) {
    displayName = displayName + '_' + new Date().getTime();
  }

  return { 
    type: "Python",
    tool: {
      content: [
        {
          activated: false,
          assets: null,
          file_inbox: null,
          oauth: metadata.oauth,
          output_arg: { json: "" },
          author,
          config: metadata.configurations?.properties ? 
            Object.entries(metadata.configurations.properties).map(([key, value]) => ({
              BasicConfig: {
                key_name: key,
                description: value.description ?? "",
                required: metadata.configurations?.required?.includes(key) ?? false,
                key_value: null
              }
            })) : [],
          description: metadata.description,
          input_args: metadata.parameters,
          keywords: metadata.keywords,
          name: displayName,
          result: metadata.result,
          sql_queries: metadata.sqlQueries,
          sql_tables: metadata.sqlTables,
          tools: metadata.tools,
          version: metadata.version,
          [toolType === "Python" ? "py_code" : "js_code"]: toolContent,
          runner: metadata.runner,
          operating_system: metadata.operating_system,
          tool_set: metadata.tool_set,
        }, 
        false
      ], 
      type: toolType,
    },
    assets,
  }
}

// deno-lint-ignore no-unused-vars
async function processAgentsDirectory() {
  const agents: DirectoryEntry[] = [];

  // Process agents
  for await (const entry of Deno.readDir("agents")) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;

    console.log(`Processing agent ${entry.name}...`);

    const agentContent = JSON.parse(await Deno.readTextFile(join("agents", entry.name)));
    const agentId = agentContent.agent_id;

    // Create zip
    const zipPath = join("packages", `${agentId}.zip`);
    const zip = new Deno.Command("zip", {
      args: ["-j", zipPath, join("agents", entry.name)],
    });
    await zip.output();

    const blake3Hash = await calculateBlake3Hash(zipPath);

    agents.push({
      toolFile: join("agents", entry.name),
      dir: join("agents"),
      name: agentContent.name,
      author,
      keywords: agentContent.keywords,
      type: "Agent",
      version: agentContent.version,
      description: agentContent.ui_description,
      hash: blake3Hash,
      file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${agentId}.zip`,
      agent_id: agentId,
      routerKey: '',
    });
  }

  return agents;
}

// deno-lint-ignore no-unused-vars
async function processCronsDirectory() {
  const crons: DirectoryEntry[] = [];

  // Process crons
  for await (const entry of Deno.readDir("crons")) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;

    console.log(`Processing cron ${entry.name}...`);

    const cronContent = JSON.parse(await Deno.readTextFile(join("crons", entry.name)));
    const cronId = entry.name.replace(".json", "");

    // Create zip
    const zipPath = join("packages", `${cronId}.zip`);
    const zip = new Deno.Command("zip", {
      args: ["-j", zipPath, join("crons", entry.name)],
    });
    await zip.output();

    const blake3Hash = await calculateBlake3Hash(zipPath);

    crons.push({
      toolFile: join("crons", entry.name),
      dir: join("crons"),
      name: cronContent.name,
      author,
      keywords: cronContent.keywords,
      type: "Scheduled Task",
      version: cronContent.version,
      description: cronContent.description,
      hash: blake3Hash,
      file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${cronId}.zip`,
      routerKey: '',
    });
  }

  return crons;
}

export async function processToolsDirectory(): Promise<DirectoryEntry[]> {
    const tools: DirectoryEntry[] = [];
    
    // Fetch store categories
    const storeCategories = await getCategories();
  
    // Process tools
    for await (const entry of Deno.readDir("tools")) {
      if (!entry.isDirectory) continue;
      const toolDir = join("tools", entry.name);
    
      // Find tool file
      let toolFile = "";
      if (await exists(join(toolDir, "tool.ts"))) {
        toolFile = join(toolDir, "tool.ts");
      } else if (await exists(join(toolDir, "tool.py"))) {
        toolFile = join(toolDir, "tool.py");
      }
  
      if (!toolFile || !await exists(join(toolDir, "metadata.json"))) {
        console.error(`Error: Missing required files in ${toolDir}`);
        throw new Error(toolDir);
      }
  
      // Read files
      const metadata: Metadata = JSON.parse(await Deno.readTextFile(join(toolDir, "metadata.json")));
      const storeMetadata: StoreMetadata = JSON.parse(await Deno.readTextFile(join(toolDir, "store.json")));
      const toolType = await getToolType(toolFile);
      const toolName = metadata.name;
      console.log(`Processing ${toolName}...`);

      // Validate tool has a category mapping
      if (!storeMetadata.categoryId) {
        throw new Error(`No categoryId found for tool ${toolName}. Please add a categoryId in store.json.`);
      }

      // Validate category exists in store
      if (!storeCategories.some(sc => sc.id === storeMetadata.categoryId)) {
        throw new Error(`Invalid categoryId ${storeMetadata.categoryId} for tool ${toolName}. Category not found in store endpoint.`);
      }
    
      if (!metadata.author) {
        throw(`Error: Missing author in metadata for ${toolName}`);
      }
      if (!metadata.keywords) {
        throw(`Error: Missing keywords in metadata for ${toolName}`);
      }
      if (!metadata.description) {
        throw(`Error: Missing description in metadata for ${toolName}`);
      }
      if (!metadata.version) {
        throw(`Error: Missing version in metadata for ${toolName}`);
      }

      const dependencies = metadata.tools;

      // Check for required images
      const iconPath = join(toolDir, "icon.png");
      const bannerPath = join(toolDir, "banner.png");
      
      if (!await exists(iconPath)) {
        throw new Error(`Missing icon.png for tool ${toolName}`);
      }
      if (!await exists(bannerPath)) {
        throw new Error(`Missing banner.png for tool ${toolName}`);
      }

      tools.push({
        routerKey: generateToolRouterKey(author, metadata.name),
        dir: toolDir,
        name: metadata.name,
        author,
        keywords: metadata.keywords,
        type: "Tool", 
        toolLanguage: toolType,
        version: metadata.version,
        description: metadata.description,
        hash: '',
        toolFile,
        file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${toolName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}.zip`,
        price_usd: metadata.price_usd || 0.00,
        categoryId: storeMetadata.categoryId,
        dependencies,
      });
    }

    // Sort, so that tools are loaded in the correct order
    const allTools: DirectoryEntry[] = JSON.parse(JSON.stringify(tools));
    const orderedTools: DirectoryEntry[] = [];
    let retries = 100;
    while(allTools.length > 0) {
      const tool = allTools.shift();
      if (!tool) break;
      const currentTools = [...systemTools, ...orderedTools.map(t => t.routerKey)];
      const expectedTools = tool.dependencies?.map((t: string) => stripVersion(t)) ?? [];
      if (expectedTools.every(e => currentTools.includes(e))) {
        orderedTools.push(tool);
      } else {
        retries -= 1;
        if (retries <= 0) throw Error('Failed to order tools');
        allTools.push(tool);
      }
    }
    return orderedTools
} 

export async function getMetadata(toolsOriginal: DirectoryEntry[]) {
  const data = [];
  for (const tool of toolsOriginal) {
    const metadata: Metadata = JSON.parse(await Deno.readTextFile(join(tool.dir, "metadata.json")));
    data.push({ name: tool.name, key: generateToolRouterKey(author, metadata.name), metadata });
  }
  return data;
}

export async function saveToolsInNode(toolsOriginal: DirectoryEntry[]): Promise<DirectoryEntry[]> {
  const tools: DirectoryEntry[] = JSON.parse(JSON.stringify(toolsOriginal));
  const toolsSaved: DirectoryEntry[] = [];
  for (const tool of tools) {
      // Wait 250ms between tool uploads
      await new Promise(resolve => setTimeout(resolve, 250));

      // Read files
      const metadata: Metadata = JSON.parse(await Deno.readTextFile(join(tool.dir, "metadata.json")));
      const toolContent = await Deno.readTextFile(tool.toolFile);
      const toolType = await getToolType(tool.toolFile);
      
      // Generate assets data
      let assets: { file_name: string, data: string }[] | undefined = undefined;
      if (await exists(join(tool.dir, "assets"))) {
        assets = [];
        for await (const entry of Deno.readDir(join(tool.dir, "assets"))) {
          assets.push({ 
            file_name: entry.name, 
            data: encodeBase64(await Deno.readFile(join(tool.dir, "assets", entry.name))),
          });
        }
      }

      // Build tool JSON
      const toolJson = await buildToolJson(toolContent, metadata, toolType, assets, tool);

      // Send to Shinkai node
      const response = await fetch(`${Deno.env.get("SHINKAI_NODE_ADDR")}/v2/add_shinkai_tool`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("BEARER_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toolJson),
      });
  
      if (!response.ok) {
        console.error(`Failed to upload tool to Shinkai node. HTTP status: ${response.status}`);
        console.error(`Response: ${await response.text()}`);
        throw Error(`Failed to upload tool ${tool.name} to Shinkai node. HTTP status: ${response.status}`);
      }
  
      // Get tool router key.
      const uploadedTool = await response.json();
      if (tool.routerKey !== uploadedTool.message.replace(/.*key: /, "")) {
        throw Error(`Tool router does not match expected router key for ${tool.name}`);
      }

      // Get tool zip
      const zipResponse = await fetch(
        `${Deno.env.get("SHINKAI_NODE_ADDR")}/v2/export_tool?tool_key_path=${tool.routerKey}`,
        {
          headers: {
            "Authorization": `Bearer ${Deno.env.get("BEARER_TOKEN")}`,
          },
        }
      );
  
      if (!zipResponse.ok) {
        console.error(`Failed to download zip for ${tool.name}`);
        throw Error(`Failed to download zip for ${tool.name}`);
      }
  
      // Save zip filex
      const zipPath = join("packages", `${tool.name}.zip`.toLowerCase().replace(/[^a-z0-9_.-]/g, '_'));
      await Deno.writeFile(zipPath, new Uint8Array(await zipResponse.arrayBuffer()));
  
      // Validate zip
      try {
        const validateZip = new Deno.Command("unzip", {
          args: ["-t", zipPath],
        });
        await validateZip.output();
        
        const zipPathFiles = join("packages", `${tool.name}`.toLowerCase().replace(/[^a-z0-9_.-]/g, '_'));
        const unzip = new Deno.Command("unzip", {
          args: [zipPath, '-d', zipPathFiles],
        });
        await unzip.output();
        
        // Enable flag to update reference files
        // copy the unzipped __tool.json to the tool directory as .tool-dump.test.json
        if (Deno.env.get("UPDATE_DUMP_FILES")) {
          await Deno.copyFile(join(zipPathFiles, "__tool.json"), join(tool.dir, ".tool-dump.test.json"));
        }

      } catch {
        console.error(`Error: Invalid zip file downloaded for ${tool.name}`);
        await Deno.remove(zipPath);
        throw Error(`Failed to validate zip file for ${tool.name}`);
      }
  
      // Calculate hash
      tool.hash = await calculateBlake3Hash(zipPath);
      
      // Check for .default file
      tool.isDefault = await exists(join(tool.dir, ".default"));

      toolsSaved.push(tool);
    }
  
    return toolsSaved;
  }
