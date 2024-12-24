import { parseArgs } from "jsr:@std/cli";
import { join } from "jsr:@std/path";

const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "llama3_1_8b";
const SHINKAI_API_URL = Deno.env.get("SHINKAI_API_URL") || "http://localhost:9950";
const BEARER_TOKEN = Deno.env.get("BEARER_TOKEN") || "debug";
const TOOL_ID = Deno.env.get("TOOL_ID") || "no-name";
const APP_ID = Deno.env.get("APP_ID") || "no-app";

/** 
This script runs tools in a Shinkai Environment
Usage: 
deno run --allow-all launch.ts <tool-name> --input=<JSON> --config=<JSON>

* --input and --config are optional, if provided, they must be a JSON string with key-value pairs.
*  Required parameters and configurations will be prompted for if not provided.

**************************************************
Example for doing an Smart Search:

deno --allow-all launch.ts smart-search --config='{"maxSources": 1}'

**************************************************
Example for sending an email:

deno --allow-all launch.ts email-sender \
    --input='{"recipient_email":"you@some-email.com", "subject":"test email", "body":"hi! this is a test email."}' \
    --config='{ "smtp_server": "server.some-email.com", "sender_email": "me@some-email.com", "sender_password": "password" }'    

*/

interface ToolMetadata {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  configurations: {
    BasicConfig: {
        description: string,
        key_name: string,
        key_value: string | null,
        required: boolean
    }
  }[];
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

async function executeCode(toolName: string, parameters: Record<string, any>, configurations: Record<string, any>, tools: string[]) {
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
      extra_config: configurations
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

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["config", "input"],
    default: { config: "{}", input: "{}" },
  });

  const toolName = args._[0] as string;

  if (!toolName) {
    console.error("Usage: deno run --allow-all launch.ts <tool-name> --config=<JSON> --input=<JSON>");
    Deno.exit(1);
  }

  try {
    const metadata = await readToolMetadata(toolName);
    const providedConfig = parseJsonArg(args.config);
    const providedInput = parseJsonArg(args.input);
    // Extract metadata information
    const allParams = Object.keys(metadata.parameters.properties) || [];
    const allConfigs = metadata.configurations.map((config) => config.BasicConfig.key_name) || [];
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
    const requiredConfigs = metadata.configurations.filter((config) => config.BasicConfig.required).map((config) => config.BasicConfig.key_name);
    for (const config of requiredConfigs) {
      if (!(config in configurations)) {
            const value = prompt(`Enter value for configuration "${config}":`);
            if (value) {
                configurations[config] = value;
            }
      }
    }

    console.log("Using parameters:", parameters);
    console.log("Using configurations:", configurations);

    const result = await executeCode(toolName, parameters, configurations, metadata.tools || []);
    console.log("Execution result:", result);
  } catch (error) {
    console.error("Error:", error.message);
    Deno.exit(1);
  }
}

main().then(() => {}).catch((error) => {
    console.error("Error:", error.message);
    Deno.exit(1);
})

