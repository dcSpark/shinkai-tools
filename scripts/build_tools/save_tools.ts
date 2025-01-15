import { DirectoryEntry, Metadata } from "./interfaces.ts";

import { join } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

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
async function buildToolJson(toolContent: string, metadata: Metadata, toolType: string) {
  // Set GENERATE_RANDOM_NAME to true to generate a random name for the tool
  // So multiple tools with the same name can be uploaded into the node.
  const generate_random_name = !!Deno.env.get("GENERATE_RANDOM_NAME");
  let name = metadata.name;
  if (generate_random_name) {
    name = name + '_' + new Date().getTime();
  }

  const content = [{
    activated: false,
    assets: null,
    file_inbox: null,
    oauth: null,
    output_arg: { json: "" },
    author: metadata.author,
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
    name: name,
    result: metadata.result,
    sql_queries: metadata.sqlQueries,
    sql_tables: metadata.sqlTables,
    toolkit_name: metadata.id,
    tools: metadata.tools,
    version: metadata.version,
    [toolType === "Python" ? "py_code" : "js_code"]: toolContent
  }, false];

  return { content, type: toolType };
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
      author: agentContent.author,
      keywords: agentContent.keywords,
      type: "Agent",
      version: agentContent.version,
      description: agentContent.ui_description,
      hash: blake3Hash,
      file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${agentId}.zip`,
      agent_id: agentId,
      routerKey: 'not-implemented-yet',
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
      author: cronContent.author,
      keywords: cronContent.keywords,
      type: "Scheduled Task",
      version: cronContent.version,
      description: cronContent.description,
      hash: blake3Hash,
      file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${cronId}.zip`,
      routerKey: 'not-implemented-yet',
    });
  }

  return crons;
}

export async function processToolsDirectory(): Promise<DirectoryEntry[]> {
    const tools: DirectoryEntry[] = [];
    
    // Process tools
    for await (const entry of Deno.readDir("tools")) {
      if (!entry.isDirectory) continue;
  
      const toolDir = join("tools", entry.name);
      const toolName = entry.name;
  
      console.log(`Processing ${toolName}...`);
  
      // Find tool file
      let toolFile = "";
      if (await exists(join(toolDir, "tool.ts"))) {
        toolFile = join(toolDir, "tool.ts");
      } else if (await exists(join(toolDir, "tool.py"))) {
        toolFile = join(toolDir, "tool.py");
      }
  
      if (!toolFile || !await exists(join(toolDir, "metadata.json"))) {
        console.error(`Error: Missing required files in ${toolDir}`);
        continue;
      }
  
      // Read files
      const metadata: Metadata = JSON.parse(await Deno.readTextFile(join(toolDir, "metadata.json")));
      const toolType = await getToolType(toolFile);
    
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

      // Toolkit name is required for the tool to be uploaded into the node.
      if (!metadata.id) { 
        throw(`Error: Missing id (toolkit_name) in metadata for ${toolName}`);
      }

      tools.push({
        // default: hasDefault,
        dir: toolDir,
        name: toolName,
        author: metadata.author,
        keywords: metadata.keywords,
        type: "Tool", 
        toolLanguage: toolType,
        version: metadata.version,
        description: metadata.description,
        routerKey: '',
        hash: '',
        toolFile,
        file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${toolName}.zip`,
        price_usd: metadata.price_usd || 0.00,
        stripeProductId: "prod_P000000000000",
        // categoryId: "cat_P000000000000", // to-do: categories not implemented yet.
      });
    }

    return tools;
} 

export async function saveToolsInNode(toolsOriginal: DirectoryEntry[]): Promise<DirectoryEntry[]> {
  const tools = JSON.parse(JSON.stringify(toolsOriginal));
  const toolsSaved: DirectoryEntry[] = [];
  for (const tool of tools) {

      // Read files
      const metadata: Metadata = JSON.parse(await Deno.readTextFile(join(tool.dir, "metadata.json")));
      const toolContent = await Deno.readTextFile(tool.toolFile);
      const toolType = await getToolType(tool.toolFile);
  
      // Build tool JSON
      const toolJson = await buildToolJson(toolContent, metadata, toolType);

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
        continue;
      }
  
      const uploadedTool = await response.json();
      tool.routerKey = uploadedTool.message.replace(/.*key: /, "");
  
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
        continue;
      }
  
      // Save zip filex
      const zipPath = join("packages", `${tool.name}.zip`);
      await Deno.writeFile(zipPath, new Uint8Array(await zipResponse.arrayBuffer()));
  
      // Validate zip
      try {
        const validateZip = new Deno.Command("unzip", {
          args: ["-t", zipPath],
        });
        await validateZip.output();
        
        const zipPathFiles = join("packages", `${tool.name}`);
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
        continue;
      }
  
      // Calculate hash
      tool.hash = await calculateBlake3Hash(zipPath);
      
      // Check for .default file
      tool.default = await exists(join(tool.dir, ".default"));

      toolsSaved.push(tool);
    }
  
    return toolsSaved;
  }