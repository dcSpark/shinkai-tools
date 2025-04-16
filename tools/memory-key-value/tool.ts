import { shinkaiSqliteQueryExecutor as shinkaiSqliteQueryExecutor_ } from "./shinkai-local-tools.ts";

type TableRow = {
  id: number;
  date: string;
  key: string;
  memory: string;
};

type CONFIG = {
  database_name?: string;
};

type INPUTS = {
  action: string; // expected 'upsert' | 'retrieve';
  data?: string;
  memory_key?: string;
};

type OUTPUT = {
  memory?: string;
  all_memories?: { key: string; memory: string }[];
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
    CREATE TABLE IF NOT EXISTS memory_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      key TEXT UNIQUE,
      memory TEXT
    );
  `;
  await shinkaiSqliteQueryExecutor({
    query: createTableQuery,
    ...(database_name && { database_name }),
  });
};

const getAllMemories = async (
  database_name: string | undefined
): Promise<TableRow[]> => {
  const fetchAllMemoriesQuery = `
    SELECT id, key, memory
      FROM memory_table
  `;
  const fetchAllMemories = await shinkaiSqliteQueryExecutor({
    query: fetchAllMemoriesQuery,
    ...(database_name && { database_name }),
  });
  return fetchAllMemories.result;
};

const getMemory = async (
  database_name: string | undefined,
  key: string
): Promise<null | TableRow> => {
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

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const {
    action,
    data,
    memory_key,
  } = inputs;

  let _action: 'retrieve' | 'upsert';
  switch ((action || '').toLowerCase()) {
    case 'insert':
    case 'upsert':
    case 'update':
    case 'delete':
      _action = 'upsert';
      break;
    case 'get':
    case 'retrieve':
      _action = 'retrieve';
      break;
    default:
      throw new Error(`Invalid action: ${action}. Valid values are 'upsert' or 'retrieve'`);
  }

  const {
    database_name,
  } = config;

  await createTable(database_name);

  // If no data provided, just return existing memories
  if (_action === 'retrieve') {
    if (!memory_key) {
      const allMemories = await getAllMemories(database_name);
      return {
        all_memories: allMemories.map(m => ({ key: m.key, memory: m.memory })),
      };
    } else {
      const existingMemory = await getMemory(database_name, memory_key.toLocaleLowerCase());
      return {
        memory: existingMemory?.memory || "",
      };
    }
  }

  // Upsert
  if (!memory_key) {
    throw new Error("Memory key is required for upsert");
  }

  const query = `
    INSERT INTO memory_table (key, memory)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET memory = excluded.memory;
  `;
  await shinkaiSqliteQueryExecutor({
    query,
    params: [memory_key.toLocaleLowerCase(), data || ''],
    ...(database_name && { database_name }),
  });

  return {
    memory: data,
  };
}
