import { shinkaiTypescriptUnsafeProcessor } from "./shinkai-local-tools.ts";

const get_ts_code = () => {
  return `
import { jsonSchemaToZod } from "json-schema-to-zod";
import pkg from '@browserbasehq/stagehand';
const { Stagehand, ConstructorParams } = pkg;
import { z } from "zod";
// This is to ensure that that "z" does not get treeshaken.
z.object({});

async function shinkaiLlmPromptProcessor(query: { prompt: string }) {
    const response = await fetch(\`\${process.env.SHINKAI_NODE_LOCATION}/v2/tool_execution\`, {
        method: "POST",
        headers: {
                'Authorization': \`Bearer \${process.env.BEARER}\`,
                'x-shinkai-tool-id': \`\${process.env.X_SHINKAI_TOOL_ID}\`,
                'x-shinkai-app-id': \`\${process.env.X_SHINKAI_APP_ID}\`,
                'x-shinkai-llm-provider': \`\${process.env.X_SHINKAI_LLM_PROVIDER}\`,
                'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tool_router_key: "local:::__official_shinkai:::shinkai_llm_prompt_processor",
            llm_provider: \`\${process.env.X_SHINKAI_LLM_PROVIDER}\`, 
            parameters: query
        })
    });

    if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return await response.json();
}

async function getSchemaForExtract(prompt: string) {
    const llmPrompt = \`
<rules>
* This command will be run when analyzing a webpage html.
* The user is requesting to extract some data from the page, and we need to generate a minimum json schema that can store these values.
* Prefer basic types as numbers, strings and boolean to store data.
* For the command in the input tag: generate a valid json schema that can store the properties requested in json format.
* write the json and nothing else, omit all comments, ideas or suggestions.
* print a valid json schema based on the template tag
</rules>

<template> 
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "example": {
      "type": "string" 
    }
  }
}
</template>

<input>
\${prompt}
</input>
\`;
    let reties = 3;
    while (true) {
        const schema = await shinkaiLlmPromptProcessor({ prompt: llmPrompt });
        const m = schema.message;
        // First try to extract data between \`\`\`json and \`\`\`
        const jsonData = m.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
        if (jsonData) {
            try { 
                return JSON.parse(jsonData[1]);
            } catch (error) {
                console.error("Error parsing JSON", error);
            }
        }
        try {
            return JSON.parse(m);
        } catch (error) {
            console.error("Error parsing JSON", error);
        }
        reties -= 1;
        if (reties < 1) throw new Error("Failed to generate schema");
    }
}
async function stagehandRun(config: CONFIG, inputs: INPUTS) {
    const stagehandConfig: ConstructorParams = {
        env: "LOCAL",
        modelName: "gpt-4o",
        modelClientOptions: {
            apiKey: process.env.OPENAI_KEY,
        },
        verbose: 1,
        executablePath: process.env.CHROME_PATH,
        enableCaching: false,
        debugDom: true /* Enable DOM debugging features */,
        headless: false /* Run browser in headless mode */,
        domSettleTimeoutMs: 10_000 /* Timeout for DOM to settle in milliseconds */,
    }

    console.log("⭐ Starting Stagehand");
    const stagehand = new Stagehand(stagehandConfig);
    const data: any[] = []; 
    try {
        console.log("🌟 Initializing Stagehand...");
        await stagehand.init();
        let stage = 0;
        while (stage < inputs.commands.length) {
            const input = inputs.commands[stage];
            if (!input) break;
            switch (input.action) {
                case "goto":
                    console.log("🌐 Navigating to ", input.payload);
                    await stagehand.page.goto(input.payload);
                    stage++;
                    break;
                case "wait":
                    console.log("🕒 Waiting for ", input.payload, "ms");
                    await new Promise((resolve) => setTimeout(resolve, parseInt(input.payload)));
                    stage++;
                    break;
                case "act":
                    console.log("👋 Acting on ", input.payload);
                    await stagehand.page.act(input.payload);
                    stage++;
                    break;
                case "extract":
                    console.log("👋 Extract ", input.payload);
                    if (!input.jsonSchema) {
                        input.jsonSchema = await getSchemaForExtract(input.payload);
                    }
                    const z_schema = jsonSchemaToZod(input.jsonSchema);
                    console.log(z_schema);
                    const schema = eval(z_schema);
                    const result: any = await stagehand.page.extract({ instruction: input.payload, schema });
                    data.push(result);
                    stage++;
                    break;
                case "goto-stage":
                    console.log("🔗 Going to stage ", input.payload);
                    const stageIndex = inputs.commands.findIndex(cmd => cmd.id === input.payload);
                    if (stageIndex === -1) {
                        throw new Error("Stage not found");
                    }
                    if (stage === stageIndex) throw new Error("Stage already reached");
                    stage = stageIndex;
                    break;
                default:
                    throw new Error("Invalid action");
            }
        }
    } catch (error) {
        try {
            await stagehand.close();
        } catch (error) {
            console.error("❌ Cannot close stagehand", error);
        }
        console.error("❌ Error", error);
        throw error; // Re-throw non-game-over errors
    }
    await stagehand.close();
    return data;
}

type CONFIG = {};
type INPUTS = {
    commands: {
        id: string,
        action: 'goto' | 'wait' | 'act' | 'goto-stage' | 'extract',
        payload: string,
        jsonSchema?: object
    }[]
};

type OUTPUTS = { message: string, data: any[] };
;

async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUTS> {
    const data = await stagehandRun(config, inputs);
    return { message: "success", data: data };
}

`;
}

const get_ts_package = () => {
  return JSON.stringify({
    "name": "standalone",
    "version": "1.0.0",
    "main": "index.ts",
    "scripts": {},
    "author": "",
    "license": "ISC",
    "description": "",
    "dependencies": {
      "@browserbasehq/stagehand": "https://github.com/dcspark/stagehand",
      "sharp": "^0.33.5",
      "json-schema-to-zod": "^2.6.0",
      "zod": "^3.24.1"
    }
  }, null, 2);
}

export async function run(config: any, parameters: any) {
    return await shinkaiTypescriptUnsafeProcessor({
        code: get_ts_code(),
        package: get_ts_package(),
        parameters,
        config,
    });
}