interface ConfigurationBasicType {
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  description: string;
  default?: string;
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
  id: string;
  name: string;
  description: string;
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
}

export interface DirectoryEntry {
  dir: string;
  default?: boolean;
  name: string;
  author: string;
  keywords: string[];
  type: "Tool" | "Agent" | "Scheduled Task";
  toolLanguage?: string;
  version: string;
  description: string;
  routerKey: string;
  hash: string;
  toolFile: string;
  file: string;
  agent_id?: string;
  price_usd?: number;
  stripeProductId?: string;
  categoryId?: string;
}
