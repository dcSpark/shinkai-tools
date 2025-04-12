import { shinkaiSqliteQueryExecutor as shinkaiSqliteQueryExecutor_ } from "./shinkai-local-tools.ts";
import { shinkaiLlmPromptProcessor } from "./shinkai-local-tools.ts";

const shinkaiSqliteQueryExecutor = (params: any) => {
  console.log("shinkaiSqliteQueryExecutor", params);
  return shinkaiSqliteQueryExecutor_(params);
};

type CONFIG = {
  database_name?: string;
};
type INPUTS = {
  data?: string;
  general_prompt?: string;
  specific_prompt?: string;
  key?: string;
};
type OUTPUT = {
  generalMemory: string;
  specificMemory: string;
};

const createTable = async (
  database_name: string | undefined
): Promise<void> => {
  // Create table if not exists
  const createTableQuery = `
        CREATE TABLE IF NOT EXISTS memory_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            key TEXT,
            memory TEXT
        );
    `;
  await shinkaiSqliteQueryExecutor({
    query: createTableQuery,
    ...(database_name && { database_name }),
  });
};

const getGeneralMemory = async (
  database_name: string | undefined
): Promise<null | { id: number; key: string; memory: string }> => {
  const fetchGeneralMemoryQuery = `
      SELECT id, key, memory
      FROM memory_table
      where key is null
    `;
  const fetchGeneralMemory = await shinkaiSqliteQueryExecutor({
    query: fetchGeneralMemoryQuery,
    ...(database_name && { database_name }),
  });

  if (fetchGeneralMemory.result.length) {
    return fetchGeneralMemory.result[0];
  }
  return null;
};

const getSpecificMemory = async (
  database_name: string | undefined,
  key: string
): Promise<null | { id: number; key: string; memory: string }> => {
  const fetchSpecificMemoryQuery = `
      SELECT id, key, memory
      FROM memory_table
      where key = ?
    `;
  const fetchSpecificMemory = await shinkaiSqliteQueryExecutor({
    query: fetchSpecificMemoryQuery,
    params: [key],
    ...(database_name && { database_name }),
  });

  if (fetchSpecificMemory.result.length) {
    return fetchSpecificMemory.result[0];
  }
  return null;
};

const generatePrompt = async (
  previousMemory: null | { id: number; key: string; memory: string },
  general_prompt: string,
  data: string
): Promise<string> => {
  let generalPrompt = `
* You must generate memories, so we can recall new and past interactions.
* Retrive past memories if there are any, and merge them with the new data.
* We should merge new and past interactions, into a single memory.
* We can restructure the memory to make it consistent and ordered.
* Keep the most important information only.
* Based on the rules tag, you must generate the output.

Use "##" to write and identify main topics
Use "#" to identify titles of definitions

Only output the new memory, without comments, suggestions or how it was generated.

This is an example on how to structure the memory, not the fields you must use.
\`\`\`
# Location
## NY: Latitude: 40.7128, Longitude: -74.0060
## CO: Latitude: -33.4569, Longitude: -70.6483
- CO has borders with Perú and Bolivia

# Known People
## John: 30 years old
## Jane: 25 years old
## Peter: is from Europe.
- John and Jane are friends 
\`\`\`

These are some sections you must understand:
  * rules tag: has the rules you must follow to generate the output.\n`;
  if (previousMemory)
    generalPrompt += `. * previous_interactions tag: has entire previous interaction memory\n`;
  generalPrompt += `. * input tag: has the new data to for creating new memories.

<rules>
  ${general_prompt}
</rules>
    `;
  if (previousMemory)
    generalPrompt += `
<previous_interactions>
  ${previousMemory.memory}
</previous_interactions>
      `;

  generalPrompt += `
<input>
  ${data}
</input>
    `;
  return generalPrompt;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const {
    data,
    general_prompt = "Synthesize important information to remember from this interaction",
    specific_prompt = "Synthesize important information to remember from this interaction",
    key,
  } = inputs;

  await createTable(config.database_name);
  // If no data provided, just return existing memories
  if (!data) {
    const existingGeneralMemory = await getGeneralMemory(config.database_name);
    const existingSpecificMemory = key
      ? await getSpecificMemory(config.database_name, key)
      : null;

    return {
      generalMemory: existingGeneralMemory?.memory || "",
      specificMemory: existingSpecificMemory?.memory || "",
    };
  }

  if (!key) {
    // Update General Memory
    const previousGeneralMemory = await getGeneralMemory(config.database_name);
    const generalPrompt = await generatePrompt(
      previousGeneralMemory,
      general_prompt,
      data
    );
    const generalResponse = await shinkaiLlmPromptProcessor({
      format: "text",
      prompt: generalPrompt,
    });
    const generalMemory = generalResponse.message;

    if (previousGeneralMemory) {
      const generalUpdateQuery = `
              UPDATE memory_table SET memory = ?
              WHERE id = ?
          `;
      await shinkaiSqliteQueryExecutor({
        query: generalUpdateQuery,
        params: [generalMemory, "" + previousGeneralMemory.id],
        ...(config.database_name && { database_name: config.database_name }),
      });
    } else {
      const generalInsertQuery = `
            INSERT INTO memory_table (memory)
            VALUES (?);
        `;
      await shinkaiSqliteQueryExecutor({
        query: generalInsertQuery,
        params: [generalMemory],
        ...(config.database_name && { database_name: config.database_name }),
      });
    }
    return { generalMemory, specificMemory: "" };
  } else {
    // Update specific memory
    const previousSpecificMemory = await getSpecificMemory(
      config.database_name,
      key
    );
    const specificPrompt = await generatePrompt(
      previousSpecificMemory,
      specific_prompt,
      data
    );
    const specificResponse = await shinkaiLlmPromptProcessor({
      format: "text",
      prompt: specificPrompt,
    });
    const specificMemory = specificResponse.message;

    if (previousSpecificMemory) {
      const specificUpdateQuery = `
            UPDATE memory_table SET memory = ?
            WHERE id = ?
        `;
      await shinkaiSqliteQueryExecutor({
        query: specificUpdateQuery,
        params: [specificMemory, "" + previousSpecificMemory.id],
        ...(config.database_name && { database_name: config.database_name }),
      });
    } else {
      const specificInsertQuery = `
            INSERT INTO memory_table (key, memory)
            VALUES (?, ?);
        `;
      await shinkaiSqliteQueryExecutor({
        query: specificInsertQuery,
        params: [key, specificMemory],
        ...(config.database_name && { database_name: config.database_name }),
      });
    }
    return { generalMemory: "", specificMemory };
  }
}
