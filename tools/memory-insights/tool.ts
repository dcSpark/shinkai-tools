import { shinkaiSqliteQueryExecutor as shinkaiSqliteQueryExecutor_ } from "./shinkai-local-tools.ts";
import { shinkaiLlmPromptProcessor } from "./shinkai-local-tools.ts";

type TableRow = {
  id: number;
  date: string;
  key: string;
  memory: string;
};

type CONFIG = {
  database_name?: string;
  general_prompt?: string;
  specific_prompt?: string;
};

type INPUTS = {
  data?: string;
  memory_key?: string;
};

type OUTPUT = {
  action: string;
  general_memory?: string;
  specific_memory?: string;
};

const shinkaiSqliteQueryExecutor = (params: {
  query: string;
  params?: string[];
  database_name?: string;
}): Promise<{ result: TableRow[] }> => {
  console.log("[SQL]", JSON.stringify(params));
  return shinkaiSqliteQueryExecutor_(params);
};


const createTable = async (
  database_name: string | undefined
): Promise<void> => {
  // Create table if not exists
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS memory_insights_table (
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
): Promise<null | TableRow> => {
  const fetchGeneralMemoryQuery = `
    SELECT id, key, memory
      FROM memory_insights_table
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
): Promise<null | TableRow> => {
  const fetchSpecificMemoryQuery = `
    SELECT id, key, memory
      FROM memory_insights_table
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
  previousMemory: null | TableRow,
  general_prompt: string,
  data: string
): Promise<string> => {
  let prompt = `
There are two actions you can perform, depending on the "input" tag contents type:
1. It's new information to remember.
2. It's an imperative instruction.

Depending on the "input" tag you must decide what action to perform.
If it's imperative, then follow the action-receive-imperative-instruction tag.

<action-receive-information>
* You must update your own memories, so we can recall new and past interactions.
* You have access to your own memories, and you can merge them with the new information.
* We should merge new and past interactions, into a single memory.
* We can restructure the memory to make it consistent and ordered.
* Keep the most important information only.
* Based on the rules tag, you must generate the output.
</action-receive-information>

<action-receive-imperative-instruction>
If you receive an imperative instruction as:
* clear all memories
* forget something specific
* update a specific memory
You must apply them to your memories.
</action-receive-imperative-instruction>

<formatting>
Use "##" to write and identify main topics
Use "#" to identify titles of definitions

Only output the new memory, without comments, suggestions or how it was generated.
Everything you output will replace the previous memory.
So if you remove information from the output, it will be forgotten.
</formatting>

<memory-example>
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
</memory-example>

<sections>
These are some sections you must understand:
  * rules tag: has the rules you must follow to generate the output.\n`;
  if (previousMemory) prompt += '  * previous_interactions tag: has entire previous interaction memory\n';

  prompt += `  * input tag: has the new data or imperative instructions.;
</sections>

<rules>
  ${general_prompt}
</rules>
    `;
  if (previousMemory)
    prompt += `
<previous_interactions>
  ${previousMemory.memory}
</previous_interactions>
      `;

  prompt += `
<input>
  ${data}
</input>
    `;
  return prompt;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const {
    data,
    memory_key,
  } = inputs;
  const {
    database_name,
    general_prompt = "Synthesize important information to remember from this interaction",
    specific_prompt = "Synthesize important information to remember from this interaction",
  } = config;

  await createTable(config.database_name);
  // If no data provided, just return existing memories
  if (!data) {
    const general_memory = (await getGeneralMemory(config.database_name))?.memory || '';
    const specific_memory = memory_key
      ? (await getSpecificMemory(database_name, memory_key))?.memory || ''
      : '';

    if (memory_key) {
      return {
        action: `retrieved general and specific memory key: [${memory_key}]`,
        general_memory,
        specific_memory,
      };
    } else {
      return {
        action: 'retrieved general memory',
        general_memory,
      };
    }
  }

  if (!memory_key) {
    // Update General Memory
    const previousGeneralMemory = await getGeneralMemory(config.database_name);
    const generalPrompt = await generatePrompt(
      previousGeneralMemory,
      general_prompt,
      data
    );
    const generalResponse: { message: string } = await shinkaiLlmPromptProcessor({
      format: "text",
      prompt: generalPrompt,
    });
    const generalMemory = generalResponse.message;

    if (previousGeneralMemory) {
      const generalUpdateQuery = `
              UPDATE memory_insights_table SET memory = ?
              WHERE id = ?
          `;
      await shinkaiSqliteQueryExecutor({
        query: generalUpdateQuery,
        params: [generalMemory, "" + previousGeneralMemory.id],
        ...(config.database_name && { database_name: config.database_name }),
      });
    } else {
      const generalInsertQuery = `
            INSERT INTO memory_insights_table (memory)
            VALUES (?);
        `;
      await shinkaiSqliteQueryExecutor({
        query: generalInsertQuery,
        params: [generalMemory],
        ...(config.database_name && { database_name: config.database_name }),
      });
    }
    return {
      action: 'updated general memory',
      general_memory: generalMemory
    };
  } else {
    // Update specific memory
    const previousSpecificMemory = await getSpecificMemory(
      database_name,
      memory_key
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
            UPDATE memory_insights_table SET memory = ?
            WHERE id = ?
        `;
      await shinkaiSqliteQueryExecutor({
        query: specificUpdateQuery,
        params: [specificMemory, "" + previousSpecificMemory.id],
        ...(config.database_name && { database_name: config.database_name }),
      });
    } else {
      const specificInsertQuery = `
            INSERT INTO memory_insights_table (key, memory)
            VALUES (?, ?);
        `;
      await shinkaiSqliteQueryExecutor({
        query: specificInsertQuery,
        params: [memory_key, specificMemory],
        ...(config.database_name && { database_name: config.database_name }),
      });
    }

    return {
      action: `updated specific memory key: [${memory_key}]`,
      specific_memory: specificMemory
    };
  }
}
