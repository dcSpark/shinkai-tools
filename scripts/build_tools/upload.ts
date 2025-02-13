import { join } from "https://deno.land/std/path/mod.ts";
import { DirectoryEntry } from "./interfaces.ts";
import { uploadAsset } from "./system.ts";
// Upload tools to Shinkai Store
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
      let { dir, toolFile, isDefault, storeFile, storeName, ...store_entry } = entry;
      if (storeFile) store_entry.file = storeFile;
      if (storeName) store_entry.name = storeName;
      let response = await fetch(`${store_addr}/store/products`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${store_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(store_entry),
      });
  
      if (response.status === 409 || response.status === 200) {
        // Upload tool assets to store
        console.log(`Uploading tool assets for ${entry.name}...`);
        store_entry.icon_url = await uploadAsset(entry.routerKey, join(entry.dir, "icon.png"), 'icon', `${entry.name}_icon.png`);
        store_entry.banner_url = [await uploadAsset(entry.routerKey, join(entry.dir, "banner.png"), 'banner', `${entry.name}_banner.png`)];
        store_entry.file = await uploadAsset(entry.routerKey, join("packages", `${entry.name}.zip`.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')), 'tool', `${entry.hash}.zip`);
        console.log(`Tool assets for ${entry.name} uploaded`);

        // Product exists, use PUT endpoint instead
        const putResponse = await fetch(`${store_addr}/store/products/${entry.routerKey}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${store_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(store_entry),
        });
        response = putResponse;
      }
  
      if (response.status !== 200) {
        console.log(`Upload to Store Response (${response.status}): ${await response.text()}`);
        console.log(`Request body failed: ${JSON.stringify(store_entry, null, 2)}`);
      }
      if (response.status === 200) {
        console.log(`Created/Updated ${entry.routerKey} to Shinkai Store successfully.`);
        if (entry.isDefault) {
          const default_tool = await fetch(`${store_addr}/store/defaults/${entry.routerKey}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${store_token}`,
            },
          });
          if (default_tool.status !== 200 && default_tool.status !== 409) {
            const message = await default_tool.text();
            console.log(`Set default tool for ${entry.routerKey} (${default_tool.status}): ${message}`);
          } 
        }
      }
    }
  }
  