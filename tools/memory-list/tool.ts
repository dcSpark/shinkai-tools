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
  action: string; // expected 'insert' | 'update' | 'retrieve' | 'retrieve_all' | 'delete';
  data?: string;
  memory_id?: number;
};

type OUTPUT = {
  memory?: string;
  all_memories?: { id: number; memory: string }[];
  id?: number;
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
    CREATE TABLE IF NOT EXISTS memory_list_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    SELECT id, memory
    FROM memory_list_table
  `;
  const fetchAllMemories = await shinkaiSqliteQueryExecutor({
    query: fetchAllMemoriesQuery,
    params: [],
    ...(database_name && { database_name }),
  });
  return fetchAllMemories.result;
};

const getMemory = async (
  database_name: string | undefined,
  id: number
): Promise<null | TableRow> => {
  const fetchSpecificMemoryQuery = `
    SELECT memory
      FROM memory_list_table
      where id = ?
    `;
  const fetchSpecificMemory = await shinkaiSqliteQueryExecutor({
    query: fetchSpecificMemoryQuery,
    params: [String(id)],
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
    memory_id,
  } = inputs;

  let _action: 'retrieve' | 'update' | 'retrieve_all' | 'delete' | 'insert';
  switch ((action || '').toLowerCase()) {
    case 'insert':
      _action = 'insert';
      break;
    case 'upsert':
    case 'update':
      _action = 'update';
      break
    case 'delete':
      _action = 'delete';
      break;
    case 'get':
    case 'retrieve':
      _action = 'retrieve';
      break;
    case 'retrieve_all':
      _action = 'retrieve_all';
      break;
    default:
      throw new Error(`Invalid action: ${action}. Valid values are 'upsert' or 'retrieve'`);
  }

  const {
    database_name,
  } = config;

  await createTable(database_name);

  if (_action === 'retrieve_all') {
    const allMemories = await getAllMemories(database_name);
    return {
      all_memories: allMemories.map(m => ({ id: Number(m.id), memory: m.memory })),
    };
  }

  // If no data provided, just return existing memories
  if (_action === 'retrieve') {
    if (memory_id == null) {
      const allMemories = await getAllMemories(database_name);
      return {
        all_memories: allMemories.map(m => ({ id: m.id, memory: m.memory })),
      };
    } else {
      const existingMemory = await getMemory(database_name, Number(memory_id));
      return {
        memory: existingMemory?.memory || "",
        id: memory_id,
      };
    }
  }

  if (_action === 'delete') {
    if (!memory_id) {
      throw new Error("Memory id is required for upsert");
    }
    const query = `
      DELETE FROM memory_list_table
      WHERE id = ?
    `;
    await shinkaiSqliteQueryExecutor({
      query,
      params: [String(memory_id)],
      ...(database_name && { database_name }),
    });
    return {
      id: Number(memory_id),
      memory: "",
    }
  }

  if (_action === 'insert') {
    const query = `
        INSERT INTO memory_list_table (memory)
        VALUES (?)
      `;
    await shinkaiSqliteQueryExecutor({
      query,
      params: [data || ''],
      ...(database_name && { database_name }),
    });
    const query_latest_id = `
        SELECT id
        FROM memory_list_table
        ORDER BY id DESC
        LIMIT 1
      `;
    const latest_id = await shinkaiSqliteQueryExecutor({
      query: query_latest_id,
      ...(database_name && { database_name }),
    });
    return {
      id: latest_id.result[0].id,
      memory: data || '',
    }
  }

  if (_action === 'update') {
    // Update.
    const query = `
      UPDATE memory_list_table
        SET memory = ?
        WHERE id = ?
      `;
    await shinkaiSqliteQueryExecutor({
      query,
      params: [data || '', String(memory_id)],
      ...(database_name && { database_name }),
    });
    return {
      id: Number(memory_id),
      memory: data || '',
    }
  }
  throw new Error("Invalid action");
}

