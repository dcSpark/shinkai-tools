import { shinkaiSqliteQueryExecutor } from './shinkai-local-tools.ts';
import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';

type CONFIG = {};
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

const createTable = async (): Promise<void> => {
  // Create table if not exists
  const createTableQuery = `
        CREATE TABLE IF NOT EXISTS memory_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            key TEXT,
            memory TEXT
        );
    `;
  await shinkaiSqliteQueryExecutor({ query: createTableQuery });
}

const getGeneralMemory = async (): Promise<null | {id: number, key: string, memory: string}> => {
  const fetchGeneralMemoryQuery = `
      SELECT id, key, memory
      FROM memory_table
      where key is null
    `;
  const fetchGeneralMemory = await shinkaiSqliteQueryExecutor({ query: fetchGeneralMemoryQuery });

  if (fetchGeneralMemory.result.length) {
    return fetchGeneralMemory.result[0];
  }
  return null;
}

const getSpecificMemory = async (key: string): Promise<null | {id: number, key: string, memory: string}> => {
  const fetchSpecificMemoryQuery = `
      SELECT id, key, memory
      FROM memory_table
      where key = ?
    `;
  const fetchSpecificMemory = await shinkaiSqliteQueryExecutor({ query: fetchSpecificMemoryQuery, params: [key] });

  if (fetchSpecificMemory.result.length) {
    return fetchSpecificMemory.result[0];
  }
  return null;
}

const generatePrompt = async (
  previousMemory: null | {id: number, key: string, memory: string},
  general_prompt: string,
  data: string): Promise<string> => {
    let generalPrompt = `
You must generate memories, so we can recall new and past interactions.
Based on the rules, you must generate the output.
We should merge new and past interactions into a single memory.
Keep the most important information only.

These are some sections you must understand:
  * rules tag: has the rules you must follow to generate the output.\n`;
    if (previousMemory) generalPrompt  += `. * previous_interactions tag: has entire previous interaction memory\n`;
    generalPrompt += `. * input tag: has the new data to for creating newa memories.

<rules>
  ${general_prompt}
</rules>
    `
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
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const {
    data,
    general_prompt = 'Important information to remember from this interaction',
    specific_prompt = 'Important information to remember from this interaction',
    key
  } = inputs;

  await createTable();

  let generalMemory = '';
  let specificMemory = '';
  // If no data provided, just return existing memories
  if (!data) {
    const existingGeneralMemory = await getGeneralMemory();
    const existingSpecificMemory = key ? await getSpecificMemory(key) : null;

    return {
      generalMemory: existingGeneralMemory?.memory || '',
      specificMemory: existingSpecificMemory?.memory || ''
    };
  }

  // Update General Memory
  const previousGeneralMemory = await getGeneralMemory();
  const generalPrompt = await generatePrompt(previousGeneralMemory, general_prompt, data);
  const generalResponse = await shinkaiLlmPromptProcessor({ format: 'text', prompt: generalPrompt });
  generalMemory = generalResponse.message;

  if (previousGeneralMemory) {
    const generalUpdateQuery = `
            UPDATE memory_table SET memory = ?
            WHERE id = ?
        `;
    await shinkaiSqliteQueryExecutor({
      query: generalUpdateQuery, params: [generalMemory, ""+ previousGeneralMemory.id]
    });
  } else {
    const generalInsertQuery = `
          INSERT INTO memory_table (memory)
          VALUES (?);
      `;
    await shinkaiSqliteQueryExecutor({ query: generalInsertQuery, params: [generalMemory]});
  }

  // Update specific memory
  if (key) {
    const previousSpecificMemory = await getSpecificMemory(key);
    const specificPrompt = await generatePrompt(previousSpecificMemory, specific_prompt, data);
    const specificResponse = await shinkaiLlmPromptProcessor({ format: 'text', prompt: specificPrompt });
    specificMemory = specificResponse.message;

    if (previousSpecificMemory) {
      const specificUpdateQuery = `
            UPDATE memory_table SET memory = ?
            WHERE id = ?
        `;
      await shinkaiSqliteQueryExecutor({
        query: specificUpdateQuery,
        params: [specificMemory, ""+previousSpecificMemory.id]
      });
    } else {
      const specificInsertQuery = `
            INSERT INTO memory_table (key, memory)
            VALUES (?, ?);
        `;
      await shinkaiSqliteQueryExecutor({
        query: specificInsertQuery,
        params: [key, specificMemory]
      });
    }
  }
  return {generalMemory, specificMemory};
}