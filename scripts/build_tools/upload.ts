import { DirectoryEntry } from "./interfaces.ts";

export async function uploadTools(tools: DirectoryEntry[]) {
    const store_addr = Deno.env.get("SHINKAI_STORE_ADDR");
    const store_token = Deno.env.get("SHINKAI_STORE_TOKEN");
    if (!store_addr || !store_token) {
        console.error("SHINKAI_STORE_ADDR or SHINKAI_STORE_TOKEN is not set");
        return;
    }
    // Create packages directory
    await Deno.mkdir("packages", { recursive: true });
  
    // Initialize empty directory.json
    await Deno.writeTextFile("packages/directory.json", "[]");
  
    // Write final directory.json
    const directory = [...tools];
    await Deno.writeTextFile("packages/directory.json", JSON.stringify(directory, null, 2));
  
    // Upload directory.json to Shinkai Store
    for (const entry of directory) {
      let response = await fetch(`${store_addr}/store/products`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${store_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      });
  
      if (response.status === 409) {
        const responseBody = await response.text();
        if (responseBody.includes("already exists")) {
          // Product exists, use PUT endpoint instead
          const putResponse = await fetch(`${store_addr}/store/products/${entry.routerKey}`, {
            method: "PUT", 
            headers: {
              "Authorization": `Bearer ${store_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(entry),
          });
          response = putResponse;
        }
      }
  
      console.log(`Upload to Store Response (${response.status}): ${await response.text()}`);
      if (response.status !== 200) console.log(`Request body failed: ${JSON.stringify(entry, null, 2)}`);
    }
  }
  