import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { validateBeerJson } from "@werb/validate";

/**
 * Recipe storage layer.
 *
 * One JSON blob in localStorage holds the user's recipe list. Each entry
 * carries a stable ID, the recipe itself (BeerJSON shape), and timestamps.
 * Mirrors the equipment-profile pattern — the app is the source of truth,
 * disk files are an import/export concern.
 */

export interface StoredRecipe {
  id: string;
  recipe: BeerJsonRecipe;
  createdAt: string;
  updatedAt: string;
}

interface RecipeStore {
  recipes: StoredRecipe[];
}

const STORAGE_KEY = "werb.recipes";

const EMPTY_STORE: RecipeStore = { recipes: [] };

export function loadStore(): RecipeStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<RecipeStore>;
    return {
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
    };
  } catch {
    return EMPTY_STORE;
  }
}

export function saveStore(store: RecipeStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Bundled sample recipes (Vite glob, eager) ────────────────────────────
//
// Kept around so the import-samples action can push them into the store on
// demand. Not loaded automatically — the store stays empty until the user
// imports something explicitly.

const bundledRaw = import.meta.glob("../../../../examples/*.beerjson", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseAndCollect(path: string, raw: string): BeerJsonRecipe[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`[recipes] ${path}: invalid JSON — ${(err as Error).message}`);
    return [];
  }
  const result = validateBeerJson(parsed);
  if (!result.valid) {
    console.warn(
      `[recipes] ${path}: failed BeerJSON 2.x validation, skipping`,
      result.errors.slice(0, 5),
    );
    return [];
  }
  return (parsed as BeerJsonFile).beerjson?.recipes ?? [];
}

export const BUNDLED_SAMPLES: BeerJsonRecipe[] = Object.entries(bundledRaw)
  .flatMap(([path, raw]) => parseAndCollect(path, raw))
  .sort((a, b) => a.name.localeCompare(b.name));
