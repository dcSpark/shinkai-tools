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
    await Deno.mkdir(`${FOLDER_PATH}/agents`, { recursive: true });
} catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
    }
}

// Fetch all agents
const response = await fetch(`${SHINKAI_NODE_ADDR}/v2/get_all_agents`, {
    headers: {
        "Authorization": `Bearer ${API_V2_KEY}`,
    },
});

const agents = await response.json();
const agentIds = agents.map((agent: any) => agent.agent_id);

// Download and process each agent
for (const agentId of agentIds) {
    console.log(`Processing agent: ${agentId}`);
    const agentDir = `${FOLDER_PATH}/agents/${agentId}`;

    // Download agent zip
    console.log(`Downloading agent: ${agentId}`);
    const agentResponse = await fetch(
        `${SHINKAI_NODE_ADDR}/v2/export_agent?agent_id=${agentId}`,
        {
            headers: {
                "Authorization": `Bearer ${API_V2_KEY}`,
            },
        },
    );
    const agentZip = await agentResponse.arrayBuffer();
    await Deno.writeFile(`${agentDir}.zip`, new Uint8Array(agentZip));

    // Create agent directory
    await Deno.mkdir(agentDir, { recursive: true });

    // Unzip the agent file
    const unzip = new Deno.Command("unzip", {
        args: ["-q", `${agentDir}.zip`, "-d", agentDir],
    });
    await unzip.output();

    // Rename __agent.json to metadata.json
    try {
        await Deno.rename(`${agentDir}/__agent.json`, `${agentDir}/metadata.json`);
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }

    // Rename __knowledge folder to knowledge
    try {
        await Deno.rename(`${agentDir}/__knowledge`, `${agentDir}/knowledge`);
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }

    // Format metadata.json
    try {
        const metadataContent = await Deno.readTextFile(`${agentDir}/metadata.json`);
        const metadata = JSON.parse(metadataContent);
        await Deno.writeTextFile(
            `${agentDir}/metadata.json`,
            JSON.stringify(metadata, null, 2),
        );

        // Update full_identity_name
        metadata.full_identity_name = `@@official.sep-shinkai/main/agent/${agentId}`;
        await Deno.writeTextFile(
            `${agentDir}/metadata.json`,
            JSON.stringify(metadata, null, 2),
        );

        // Process tools
        if (metadata.tools && Array.isArray(metadata.tools)) {
            await Deno.mkdir(`${FOLDER_PATH}/tools`, { recursive: true });

            // List all files in the __tools directory
            let toolFiles: string[] = [];
            try {
                toolFiles = Array.from(Deno.readDirSync(`${agentDir}/__tools`)).map(f => f.name);
            } catch (error) {
                if (!(error instanceof Deno.errors.NotFound)) {
                    throw error;
                }
            }

            for (const zipFile of toolFiles) {
                if (zipFile.endsWith('.zip')) {
                    const toolName = zipFile
                        .replace('.zip', '')
                        .replace('local_____official_shinkai___', '');
                    const toolDir = `${FOLDER_PATH}/tools/${toolName}`;
                    try {
                        await Deno.stat(toolDir);
                    } catch {
                        console.log(`Extracting tool: ${toolName}`);
                        const unzipTool = new Deno.Command("unzip", {
                            args: ["-q", `${agentDir}/__tools/${zipFile}`, "-d", toolDir],
                        });
                        await unzipTool.output();

                        // After unzipping, process __tool.json if it exists
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
                                    name, description, keywords, version: version || "1.0.0", author,
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
                                    parameters: input_args, result, sqlQueries: sql_queries,
                                    sqlTables: sql_tables, tools, runner, operating_system, tool_set
                                };
                                await Deno.writeTextFile(`${toolDir}/metadata.json`, JSON.stringify(metadata, null, 2));
                                // Write tool.ts or tool.py
                                if (toolType === "Python" && toolObj.py_code) {
                                    await Deno.writeTextFile(`${toolDir}/tool.py`, toolObj.py_code);
                                } else if (toolType === "Deno" && toolObj.js_code) {
                                    await Deno.writeTextFile(`${toolDir}/tool.ts`, toolObj.js_code);
                                }
                            }

                            await Deno.remove(toolJsonPath);

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
                        } catch (err) {
                            console.warn(`No __tool.json found or error processing for ${toolDir}:`, err);
                        }
                    }
                }
            }
        }

        // Create store.json
        const storeJson = {
            categoryId: "5f10d0b4-6acd-477a-96e1-be35634465b2",
            name: metadata.name,
            description: metadata.ui_description,
            version: "1.0.0",
            author: "@@official.sep-shinkai",
            keywords: [],
        };

        await Deno.writeTextFile(
            `${agentDir}/store.json`,
            JSON.stringify(storeJson, null, 2),
        );
    } catch (error) {
        console.error(`Error processing metadata for agent ${agentId}:`, error);
    }

    // Delete __tools folder
    try {
        await Deno.remove(`${agentDir}/__tools`, { recursive: true });
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }
}

// Clean up zip files
for (const agentId of agentIds) {
    try {
        await Deno.remove(`${FOLDER_PATH}/agents/${agentId}.zip`);
    } catch (error) {
        console.error(`Error removing zip for agent ${agentId}:`, error);
    }
}

// Generate images
try {
    if (!Deno.env.get("BFL_API_KEY")) throw new Error("BFL_API_KEY environment variable not found.");

    const generateImages = new Deno.Command("deno", {
        args: ["run", "-A", "scripts/generate_images.ts"],
        env: {
            DIR_NAME: `${FOLDER_PATH}/agents`,
            BFL_API_KEY: Deno.env.get("BFL_API_KEY") as string,
        },
    });
    await generateImages.output();
} catch (error) {
    console.error(`Error generating images: ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`Process complete. Processed files are in the ${FOLDER_PATH} directory.`); 