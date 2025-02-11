// These values and function are defined by the shinkai-node.

export const author = "@@official.shinkai";

export const systemTools = [
    "local:::__official_shinkai:::shinkai_llm_prompt_processor",
    "local:::__official_shinkai:::shinkai_llm_map_reduce_processor",
    "local:::__official_shinkai:::shinkai_sqlite_query_executor",
    "local:::__official_shinkai:::shinkai_process_embeddings",
    "local:::__official_shinkai:::shinkai_tool_config_updater",
    "local:::__official_shinkai:::shinkai_typescript_unsafe_processor",
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

export async function uploadAsset(
  routerKey: string, 
  filePath: string, 
  assetType: 'icon' | 'banner' | 'tool',
  fileName: string
): Promise<string> {
  const formData = new FormData();
  const file = await Deno.readFile(filePath);

  switch (assetType) {
    case 'icon':
      formData.append('file', new Blob([file], { type: 'image/png' }), 'icon.png');
      break;
    case 'banner':
      formData.append('file', new Blob([file], { type: 'image/png' }), 'banner.png');
      break;
    case 'tool':
      formData.append('file', new Blob([file], { type: 'application/zip' }), fileName);
      break;
  }


  const response = await fetch(`${Deno.env.get("SHINKAI_STORE_ADDR")}/store/products/${routerKey}/assets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get("SHINKAI_STORE_TOKEN")}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${assetType} for ${routerKey} in path ${filePath}`);
  }

  const data = await response.json();
  return data.url;
}

