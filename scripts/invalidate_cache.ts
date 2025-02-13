// Make this a module
export {};

interface DirectoryEntry {
  file: string;
}

const CLOUDFLARE_ZONE = Deno.env.get("CLOUDFLARE_ZONE");
const CLOUDFLARE_TOKEN = Deno.env.get("CLOUDFLARE_TOKEN");

if (!CLOUDFLARE_TOKEN) {
  console.error("CLOUDFLARE_TOKEN environment variable is required");
  Deno.exit(1);
}

try {
  const directoryContent = await Deno.readTextFile("packages/directory.json");
  const directory: DirectoryEntry[] = JSON.parse(directoryContent);
  
  const files = directory.map(entry => entry.file);
  files.push(`${Deno.env.get("DOWNLOAD_PREFIX")}${Deno.env.get("NODE_VERSION")?.replace(/^v/, '')}/directory.json`);
  console.log(`URLs to invalidate: ${JSON.stringify(files, null, 2)}`);
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE}/purge_cache`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    }
  );

  const result = await response.json();
  console.log(`Cache invalidation response (${response.status}):`, JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error("Failed to invalidate cache");
    Deno.exit(1);
  }
} catch (error) {
  console.error("Error:", error);
  Deno.exit(1);
} 