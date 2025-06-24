const SHINKAI_NODE_ADDR = Deno.env.get("SHINKAI_NODE_ADDR") || "http://127.0.0.1:9550";
const API_V2_KEY = Deno.env.get("API_V2_KEY") || "debug";
const FOLDER_PATH = Deno.env.get("FOLDER_PATH") || "node_dump";

// Check if folder exists and ask for confirmation to delete
try {
    const folderInfo = await Deno.stat(FOLDER_PATH);
    if (folderInfo.isDirectory) {
        const confirmDelete = prompt(`The ${FOLDER_PATH} folder already exists. Do you want to delete it? (y/N): `);
        if (confirmDelete?.toLowerCase() === 'y') {
            await Deno.remove(FOLDER_PATH, { recursive: true });
            console.log(`Deleted existing ${FOLDER_PATH} folder`);
        } else {
            console.log("Operation cancelled by user");
            Deno.exit(0);
        }
    }
} catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
    }
}

// Ensure the folder exists
try {
    await Deno.mkdir(`${FOLDER_PATH}/tools`, { recursive: true });
} catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
    }
}

// Fetch all tools
const response = await fetch(`${SHINKAI_NODE_ADDR}/v2/list_playground_tools`, {
    headers: {
        "Authorization": `Bearer ${API_V2_KEY}`,
    },
});

const tools = await response.json();
const toolRouterKeys = tools.map((tool: any) => tool.tool_router_key);

// Download and process each tool
for (const toolRouterKey of toolRouterKeys) {
    console.log(`Processing tool: ${toolRouterKey}`);
    const toolName = toolRouterKey.split(':::')[2] || toolRouterKey;
    const toolDir = `${FOLDER_PATH}/tools/${toolName}`;

    // Download tool zip
    console.log(`Downloading tool: ${toolName}`);
    const toolResponse = await fetch(
        `${SHINKAI_NODE_ADDR}/v2/export_tool?tool_key_path=${encodeURIComponent(toolRouterKey)}`,
        {
            headers: {
                "Authorization": `Bearer ${API_V2_KEY}`,
            },
        },
    );
    const toolZip = await toolResponse.arrayBuffer();
    await Deno.writeFile(`${toolDir}.zip`, new Uint8Array(toolZip));

    // Create tool directory
    await Deno.mkdir(toolDir, { recursive: true });

    // Unzip the tool file
    const unzip = new Deno.Command("unzip", {
        args: ["-q", `${toolDir}.zip`, "-d", toolDir],
    });
    await unzip.output();

    // Process the extracted tool files
    const toolJsonPath = `${toolDir}/__tool.json`;
    try {
        const toolJsonContent = await Deno.readTextFile(toolJsonPath);
        const toolJson = JSON.parse(toolJsonContent);
        const toolObj = toolJson.content?.[0];
        const toolType = toolJson.type;

        if (toolObj && toolType) {
            // Write metadata.json
            const {
                name, description, keywords, version, author, config, oauth,
                input_args, result, sql_queries, sql_tables, tools,
                runner, operating_system, tool_set,
            } = toolObj;

            const metadata = {
                name,
                description,
                keywords,
                version: version || "1.0.0",
                author,
                configurations: {
                    properties: config?.reduce((acc: Record<string, { description: string; type: string }>, curr: { BasicConfig: { key_name: string; description: string } }) => ({
                        ...acc,
                        [curr.BasicConfig.key_name]: {
                            description: curr.BasicConfig.description,
                            type: "string"
                        }
                    }), {}),
                    required: config?.filter((c: { BasicConfig: { required: boolean; key_name: string } }) => c.BasicConfig.required)
                        .map((c: { BasicConfig: { key_name: string } }) => c.BasicConfig.key_name) || []
                },
                oauth,
                parameters: input_args,
                result,
                sqlQueries: sql_queries,
                sqlTables: sql_tables,
                tools,
                runner,
                operating_system,
                tool_set
            };

            await Deno.writeTextFile(`${toolDir}/metadata.json`, JSON.stringify(metadata, null, 2));

            // Write tool.ts or tool.py
            if (toolType === "Python" && toolObj.py_code) {
                await Deno.writeTextFile(`${toolDir}/tool.py`, toolObj.py_code);
            } else if (toolType === "Deno" && toolObj.js_code) {
                await Deno.writeTextFile(`${toolDir}/tool.ts`, toolObj.js_code);
            }

            // Create store.json
            const storeJson = {
                categoryId: "5f10d0b4-6acd-477a-96e1-be35634465b2",
                name: toolObj.name,
                description: toolObj.description,
            };

            await Deno.writeTextFile(
                `${toolDir}/store.json`,
                JSON.stringify(storeJson, null, 2),
            );
        }

        // Remove the original __tool.json file
        await Deno.remove(toolJsonPath);
    } catch (err) {
        console.warn(`No __tool.json found or error processing for ${toolDir}:`, err);
    }

    // Clean up the zip file
    try {
        await Deno.remove(`${toolDir}.zip`);
    } catch (error) {
        console.error(`Error removing zip for tool ${toolName}:`, error);
    }
}

// Generate images
try {
    if (!Deno.env.get("BFL_API_KEY")) throw new Error("BFL_API_KEY environment variable not found.");

    const generateImages = new Deno.Command("deno", {
        args: ["run", "-A", "scripts/generate_images.ts"],
        env: {
            DIR_NAME: `${FOLDER_PATH}/tools`,
            BFL_API_KEY: Deno.env.get("BFL_API_KEY") as string,
        },
    });
    await generateImages.output();
} catch (error) {
    console.error(`Error generating images: ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`Process complete. Processed tools are in the ${FOLDER_PATH} directory.`); 
