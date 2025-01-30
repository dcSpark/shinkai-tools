import { parseArgs } from "jsr:@std/cli";
import { join } from "jsr:@std/path";

const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "llama3_1_8b";
const SHINKAI_API_URL = Deno.env.get("SHINKAI_API_URL") || "http://localhost:9550";
const BEARER_TOKEN = Deno.env.get("BEARER_TOKEN") || "debug";
const TOOL_ID = Deno.env.get("TOOL_ID") || "no-name";
const APP_ID = Deno.env.get("APP_ID") || "no-app";
/** 
This script runs tools in a Shinkai Environment
Usage: 
deno run --allow-all launch.ts <tool-name> [--input=<JSON>] [--config=<JSON>] [--create-file=<file-name>] [--create-file-content=<text>] [--mount=<file-name>]    

* <tool-name> - The name of the tool to run, must match the folder name in the ./tools/ directory.
* --input=<JSON> and --config=<JSON> (optional) - if provided with key-value pairs.
* --create-file=<file-name> (optional) - Creates a file in the Shinkai App.
* --create-file-content=<text> (optional) - Adds initial content to the file created.
* --mount=<file-name> (optional) - Adds a file to the mounts array. Can be specified multiple times.

NOTE Required parameters and configurations will be prompted for if not provided.

**************************************************
Example for doing an Smart Search:

deno --allow-all launch.ts smart-search --config='{"maxSources": 1}'

**************************************************
Example for sending an email:

deno --allow-all launch.ts email-sender \
     --input='{"recipient_email":"you@some-email.com", "subject":"test email", "body":"hi! this is a test email."}' \
     --config='{ "smtp_server": "server.some-email.com", "sender_email": "me@some-email.com", "sender_password": "password" }'    

**************************************************
Example for creating areading a file:

deno --allow-all launch.ts read-file \
     --input='{"path":"/home/user/test.txt"}' \
     --create-file="/home/user/test.txt" \
     --create-file-content="This is a test file."


**************************************************
Example for writing to a file:

deno --allow-all launch.ts file-write \ 
     --input='{"path":"/home/user/test.txt, "content":"Hi!" }' \
     --mount=/home/user/test.txt 

**************************************************
Example for updating a file with a prompt:  

deno --allow-all launch.ts file-update \
     --input='{"path":"/home/user/test.txt", "prompt":"write a cat poem"}' \
     --mount=/home/user/test.txt

*/

interface ToolMetadata {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: {
        type: string,
        description: string,
    }
    required: string[];
  };
  configurations: {
    BasicConfig: {
        description: string,
        key_name: string,
        key_value: string | null,
        required: boolean
    }
  }[] | {
    type: string,
    properties: {
        type: string,
        description: string,
    }
    required: string[]
  },
  tools: string[];
}

async function readToolMetadata(toolName: string): Promise<ToolMetadata> {
  const metadataPath = join("tools", toolName, "metadata.json");
  try {
    const metadataContent = await Deno.readTextFile(metadataPath);
    return JSON.parse(metadataContent);
  } catch (error) {
    throw new Error(`Failed to read metadata for tool ${toolName}: ${error.message}`);
  }
}

async function readToolCode(toolName: string): Promise<{ code: string; toolType: "denodynamic" | "pythondynamic" }> {
  const tsPath = join("tools", toolName, "tool.ts");
  const pyPath = join("tools", toolName, "tool.py");
  
  try {
    const code = await Deno.readTextFile(tsPath);
    return { code, toolType: "denodynamic" };
  } catch {
    try {
      const code = await Deno.readTextFile(pyPath);
      return { code, toolType: "pythondynamic" };
    } catch {
      throw new Error(`Could not find tool implementation for ${toolName}`);
    }
  }
}

async function executeCode(toolName: string, parameters: Record<string, any>, configurations: Record<string, any>, tools: string[], mounts: string[]) {
  const { code, toolType } = await readToolCode(toolName);
  
  const response = await fetch(`${SHINKAI_API_URL}/v2/code_execution`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "x-shinkai-tool-id": TOOL_ID,
      "x-shinkai-app-id": APP_ID,
      "x-shinkai-llm-provider": LLM_PROVIDER,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      code,
      tool_type: toolType,
      llm_provider: LLM_PROVIDER,
      tools,
      parameters,
      extra_config: configurations,
      mounts,
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to execute code: ${response.statusText}`);
  }

  return await response.json();
}

function parseJsonArg(arg: string | undefined): Record<string, any> {
  if (!arg) return {};
  try {
    return JSON.parse(arg);
  } catch (error) {
    throw new Error(`Failed to parse JSON argument: ${error.message}`);
  }
}

// TODO: 
//
// This is a temporary function to create a file in the Shinkai App.
// This should be replaced with a proper file creation API call.
// This cannot be done yet, as we don't have access to the absolute path of the file created.
//
async function createFile(fileName: string, content?: string) {
//   const formData = new FormData();
//   formData.append("file_name", fileName);
//   if (content) {
//     const blob = new Blob([content], { type: 'text/plain' });
//     formData.append("file", blob, fileName);
//   }
//   Post to the API to create the file. 
//   POST /v2/app_files
  await Deno.writeTextFile(fileName, content || "");
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["config", "input", "create-file", "create-file-content", "mount"],
    default: { config: "{}", input: "{}" },
    collect: ["mount"], // Allows multiple --mount flags
  });

  const toolName = args._[0] as string;

  if (!toolName) {
    console.error("Usage: deno run --allow-all launch.ts <tool-name> [--config=<JSON>] [--input=<JSON>] [--create-file=<file-name>] [--create-file-content=<text>] [--mount=<file-name>]");
    Deno.exit(1);
  }

  try {
    // Create file if flag is set
    if (args["create-file"]) {
      console.log("Creating file:", args["create-file"]);
      await createFile(args["create-file"], args["create-file-content"]);
      console.log("File created successfully");
      console.log("--------------------------------");
    }

    const metadata = await readToolMetadata(toolName);
    const providedConfig = parseJsonArg(args.config);
    const providedInput = parseJsonArg(args.input);
    // Extract metadata information
    const allParams = Object.keys(metadata.parameters.properties) || [];
    const allConfigs = Array.isArray(metadata.configurations) ? 
        metadata.configurations.map((config) => config.BasicConfig.key_name) : 
        Object.keys(metadata.configurations.properties);

    console.log("Available parameters:", allParams.join(", "));
    console.log("Available configurations:", allConfigs.join(", "));
    console.log("--------------------------------");
    const parameters: Record<string, any> = { ...providedInput };
    const configurations: Record<string, any> = { ...providedConfig };

    // Prompt only for missing required parameters
    for (const param of metadata.parameters.required || []) {
      if (!(param in parameters)) {
            const value = prompt(`Enter value for parameter "${param}":`);
            if (value) {
                parameters[param] = value;
            } 
      }
    }

    // Prompt only for missing required configurations
    const requiredConfigs = Array.isArray(metadata.configurations) ? 
        metadata.configurations.filter((config) => config.BasicConfig.required).map((config) => config.BasicConfig.key_name) : 
        metadata.configurations.required;

    for (const config of requiredConfigs) {
      if (!(config in configurations)) {
            const value = prompt(`Enter value for configuration "${config}":`);
            if (value) {
                configurations[config] = value;
            }
      }
    }

    function printProgress(progress){
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`Execution time: ${progress}ms`);
    }

    console.log("Using parameters:", parameters);
    console.log("Using configurations:", configurations);


    console.log("--------------------------------");
    console.log("Executing tool:", toolName);
    const startTime = Date.now();
    process.stdout.write(`Execution time: 0ms`);
    let t = setInterval(() => {
        printProgress(Date.now() - startTime);
    }, 100);

    const mounts: string[] = [];
    
    // Add created file to mounts if it exists
    if (args["create-file"]) {
      mounts.push(await Deno.realPath(args["create-file"]));
    }
    
    // Add any additional mounted files
    if (Array.isArray(args.mount)) {
      for (const mountPath of args.mount) {
        try {
          mounts.push(await Deno.realPath(mountPath));
        } catch (error) {
          console.warn(`Warning: Could not resolve mount path ${mountPath}: ${error.message}`);
        }
      }
    }

    const result = await executeCode(toolName, parameters, configurations, metadata.tools || [], mounts);
    clearInterval(t);
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log("\n--------------------------------");
    console.log("Execution result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    Deno.exit(1);
  }
}

main().then(() => {}).catch((error) => {
    console.error("Error:", error.message);
    Deno.exit(1);
})

