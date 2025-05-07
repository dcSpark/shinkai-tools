interface ConfigurationBasicType {
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  description: string;
  isDefault?: string;
}

interface ConfigurationArray {
  type: 'array';
  items: Configuration;
  description?: string;
}

interface ConfigurationObject {
  type: 'object';
  properties: Record<string, Configuration>;
  required: string[];
  description?: string;
}

type Configuration = ConfigurationBasicType | ConfigurationArray | ConfigurationObject;

export interface Metadata {
  name: string;
  description: string;
  ui_description: string;
  author: string;
  version: string;
  keywords: string[];
  configurations: ConfigurationObject;
  parameters: ConfigurationObject;
  result: ConfigurationObject;
  price_usd?: number; // to-do: add to metadata.json
  stripeProductId?: string; // to-do: add to metadata.json
  categoryId?: string; // to-do: add to metadata.json
  tools: string[];
  sqlTables: {
    name: string;
    definition: string;
  }[];
  sqlQueries: {
    name: string;
    query: string;
  }[];
  oauth: Record<string, string>[] | null;
  runner: string;
  operating_system: string[];
  tool_set: string;
}

export interface AgentMetadata {
  name: string;
  agent_id: string;
  full_identity_name: string;
  llm_provider_id: string;
  ui_description: string;
  knowledge: string[];
  storage_path: string;
  tools: string[];
  debug_mode: boolean;
  config: {
    custom_system_prompt: string;
    custom_prompt: string;
    temperature: number;
    max_tokens: number | null;
    seed: number | null;
    top_k: number;
    top_p: number;
    stream: boolean;
    other_model_params: Record<string, unknown>;
    use_tools: boolean | null;
  };
  price_usd?: number; // to-do: add to metadata.json
  stripeProductId?: string; // to-do: add to metadata.json
  categoryId?: string; // to-do: add to metadata.json
}

export interface StoreMetadata {
  author?: string;
  keywords?: string[];
  description?: string;
  version?: string;
  categoryId: string;
  node_version?: string;
  name?: string;
}

export interface DirectoryEntry {
  dir: string;
  routerKey: string;
  isDefault?: boolean;
  name: string;
  storeName?: string;
  author: string;
  keywords: string[];
  type: "Tool" | "Agent" | "Scheduled Task";
  toolLanguage?: string;
  version: string;
  description: string;
  hash: string;
  toolFile: string;
  file: string;
  storeFile?: string;
  agent_id?: string;
  price_usd?: number;
  stripeProductId?: string;
  categoryId?: string;
  dependencies?: string[];
  icon_url?: string;
  banner_url?: string[];
}
