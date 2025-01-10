import { join } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";
import { encode } from "https://deno.land/std/encoding/base64.ts";

interface Metadata {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  keywords: string[];
  configurations?: {
    properties: Record<string, any>;
    required: string[];
  };
  parameters: {
    properties: Record<string, any>;
  };
  result: Record<string, any>;
  price_usd?: number; // to-do: add to metadata.json
  stripeProductId?: string; // to-do: add to metadata.json
  categoryId?: string; // to-do: add to metadata.json
}

interface DirectoryEntry {
  default?: boolean;
  name: string;
  author: string;
  keywords: string[];
  type: "Tool" | "Agent" | "Scheduled Task";
  toolLanguage?: string;
  version: string;
  description: string;
  routerKey: string;
  hash: string;
  file: string;
  agent_id?: string;
  price_usd?: number;
  stripeProductId?: string;
  categoryId?: string;
}

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

async function buildToolJson(toolContent: string, metadata: Metadata, toolType: string) {
  const content = [{
    activated: false,
    assets: null,
    file_inbox: null,
    oauth: null,
    output_arg: { json: "" },
    author: metadata.author || "Unknown",
    config: metadata.configurations?.properties ? 
      Object.entries(metadata.configurations.properties).map(([key, value]) => ({
        BasicConfig: {
          key_name: key,
          description: value.description || "",
          required: metadata.configurations?.required?.includes(key) || false,
          key_value: null
        }
      })) : [],
    description: metadata.description || "No description provided.",
    input_args: metadata.parameters || [],
    keywords: metadata.keywords || [],
    name: metadata.name || "Unknown",
    result: metadata.result || {},
    sql_queries: [],
    sql_tables: [],
    toolkit_name: metadata.id || "Unknown",
    tools: [],
    version: metadata.version || "1.0.0",
    [toolType === "Python" ? "py_code" : "js_code"]: toolContent
  }, false];

  return { content, type: toolType };
}

async function processToolsDirectory() {
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
    const toolContent = await Deno.readTextFile(toolFile);
    const toolType = await getToolType(toolFile);

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
    const toolRouterKey = uploadedTool.message.replace(/.*key: /, "");

    // Get tool zip
    const zipResponse = await fetch(
      `${Deno.env.get("SHINKAI_NODE_ADDR")}/v2/export_tool?tool_key_path=${toolRouterKey}`,
      {
        headers: {
          "Authorization": `Bearer ${Deno.env.get("BEARER_TOKEN")}`,
        },
      }
    );

    if (!zipResponse.ok) {
      console.error(`Failed to download zip for ${toolName}`);
      continue;
    }

    // Save zip file
    const zipPath = join("packages", `${toolName}.zip`);
    await Deno.writeFile(zipPath, new Uint8Array(await zipResponse.arrayBuffer()));

    // Validate zip
    try {
      const validateZip = new Deno.Command("unzip", {
        args: ["-t", zipPath],
      });
      await validateZip.output();
    } catch {
      console.error(`Error: Invalid zip file downloaded for ${toolName}`);
      await Deno.remove(zipPath);
      continue;
    }

    // Calculate hash
    const blake3Hash = await calculateBlake3Hash(zipPath);

    // Check for .default file
    const hasDefault = await exists(join(toolDir, ".default"));

    tools.push({
      // default: hasDefault,
      name: toolName,
      author: metadata.author || "Unknown",
      keywords: metadata.keywords || ["tool"],
      type: "Tool", 
      toolLanguage: toolType,
      version: metadata.version || "0.0.0",
      description: metadata.description || "No description provided.",
      routerKey: toolRouterKey,
      hash: blake3Hash,
      file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${toolName}.zip`,
      price_usd: metadata.price_usd || 0.00,
      stripeProductId: "prod_P000000000000",
      // categoryId: "cat_P000000000000", // to-do: categories not implemented yet.
    });
  }

  return tools;
}

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
      name: agentContent.name,
      author: agentContent.author || "Unknown",
      keywords: agentContent.keywords || ["agent"],
      type: "Agent",
      version: agentContent.version || "0.0.0",
      description: agentContent.ui_description,
      hash: blake3Hash,
      file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${agentId}.zip`,
      agent_id: agentId,
      routerKey: 'not-implemented-yet',
    });
  }

  return agents;
}

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
      name: cronContent.name,
      author: cronContent.author || "Unknown",
      keywords: cronContent.keywords || ["cron"],
      type: "Scheduled Task",
      version: cronContent.version || "0.0.0",
      description: cronContent.description,
      hash: blake3Hash,
      file: `${Deno.env.get("DOWNLOAD_PREFIX")}/${cronId}.zip`,
      routerKey: 'not-implemented-yet',
    });
  }

  return crons;
}

async function processProducts() {
  // Create packages directory
  await Deno.mkdir("packages", { recursive: true });

  // Initialize empty directory.json
  await Deno.writeTextFile("packages/directory.json", "[]");

  // Process all directories in parallel
  const [tools] = await Promise.all([
    processToolsDirectory(),
    // processAgentsDirectory(),
    // processCronsDirectory()
  ]);

  // Write final directory.json
  const directory = [...tools];
  await Deno.writeTextFile("packages/directory.json", JSON.stringify(directory, null, 2));

  // Upload directory.json to Shinkai Store
  for (const entry of directory) {
    let response = await fetch(`${Deno.env.get("SHINKAI_STORE_ADDR")}/store/products`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SHINKAI_STORE_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });

    if (response.status === 409) {
      const responseBody = await response.text();
      if (responseBody.includes("already exists")) {
        // Product exists, use PUT endpoint instead
        const putResponse = await fetch(`${Deno.env.get("SHINKAI_STORE_ADDR")}/store/products/${entry.router_key}`, {
          method: "PUT", 
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SHINKAI_STORE_TOKEN")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(entry),
        });
        response = putResponse;
      }
    }

    console.log(`Upload to Store Response (${response.status}): ${await response.text()}`);
    if (response.status !== 200) console.log(`Request body failed: ${JSON.stringify(entry, null, 2)}`);
  }
}

// Run the script
if (import.meta.main) {
  await processProducts();
} 