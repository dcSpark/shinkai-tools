import { join } from "https://deno.land/std/path/mod.ts";

export interface Category {
  id: string;
  name: string;
  description: string;
  examples: string;
}

const STORE_CATEGORIES_ENDPOINT = "https://shinkai-store-302883622007.us-central1.run.app/store/categories";

export async function fetchCategoriesFromStore(): Promise<Category[]> {
  try {
    const response = await fetch(STORE_CATEGORIES_ENDPOINT);
    if (!response.ok) {
      throw new Error(`Failed to fetch categories. Status: ${response.status}`);
    }
    const categories: Category[] = await response.json();
    return categories;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error fetching categories from store: ${errorMessage}`);
  }
}

// Cache categories in a local file for fallback
export async function cacheCategories(categories: Category[]): Promise<void> {
  const cachePath = join("tools", ".categories-cache.json");
  await Deno.writeTextFile(cachePath, JSON.stringify(categories, null, 2));
}

// Load cached categories as fallback
export async function loadCachedCategories(): Promise<Category[]> {
  try {
    const cachePath = join("tools", ".categories-cache.json");
    const cachedData = await Deno.readTextFile(cachePath);
    return JSON.parse(cachedData);
  } catch {
    return [];
  }
}

// Get categories with fallback to cache
export async function getCategories(): Promise<Category[]> {
  try {
    const categories = await fetchCategoriesFromStore();
    await cacheCategories(categories);
    return categories;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Failed to fetch categories from store: ${errorMessage}`);
    console.warn("Falling back to cached categories...");
    const cached = await loadCachedCategories();
    if (cached.length === 0) {
      throw new Error("No categories available - neither from store nor cache");
    }
    return cached;
  }
}
