// These values and function are defined by the shinkai-node.

export const author = "@@official.shinkai";

export const systemTools = [
    "local:::__official_shinkai:::shinkai_llm_prompt_processor",
    "local:::__official_shinkai:::shinkai_sqlite_query_executor",
    "local:::__official_shinkai:::shinkai_process_embeddings",
    "local:::__official_shinkai:::shinkai_tool_config_updater",
  ];

export function generateToolRouterKey(author: string, name: string): string {
  return `local:::${author.toLowerCase().replace(/[^a-z0-9_]/g, '_')}:::${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
}

export function stripVersion(toolKey: string): string {
  const parts = toolKey.split(":::");
  if (parts.length === 3) return toolKey;
  if (parts.length === 4) return parts[0] + ":::" + parts[1] + ":::" + parts[2];
  throw Error('Invalid name');
}

