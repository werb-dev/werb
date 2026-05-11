import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { validateBeerJson } from "@werb/validate";
import type { StorageBackend } from "../storage/index.ts";

/**
 * Recipe storage layer.
 *
 * One JSON blob holds the user's recipe list. Each entry carries a stable
 * ID, the recipe itself (BeerJSON shape), and timestamps. The persistence
 * target is abstracted behind StorageBackend — today that's localStorage,
 * tomorrow it can be Drive / GitHub / OPFS without changes here.
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

export const RECIPES_STORAGE_KEY = "werb.recipes";

const EMPTY_STORE: RecipeStore = { recipes: [] };

function parseStore(raw: string | null): RecipeStore {
  if (!raw) return EMPTY_STORE;
  try {
    const parsed = JSON.parse(raw) as Partial<RecipeStore>;
    return { recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [] };
  } catch {
    return EMPTY_STORE;
  }
}

/**
 * Sync read used by hooks for first-render hydration when the backend
 * supports it (localStorage, in-memory). Returns the empty store when
 * the backend has no `readSync` — async backends should call `loadStore`
 * inside an effect instead.
 */
export function loadStoreSync(backend: StorageBackend): RecipeStore {
  if (!backend.readSync) return EMPTY_STORE;
  return parseStore(backend.readSync(RECIPES_STORAGE_KEY));
}

export async function loadStore(backend: StorageBackend): Promise<RecipeStore> {
  return parseStore(await backend.read(RECIPES_STORAGE_KEY));
}

export async function saveStore(
  backend: StorageBackend,
  store: RecipeStore,
): Promise<void> {
  await backend.write(RECIPES_STORAGE_KEY, JSON.stringify(store));
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

// ─── Import from disk (Tauri only) ────────────────────────────────────────

export interface ImportResult {
  recipes: BeerJsonRecipe[];
  error?: string;
}

/**
 * Parse a raw BeerJSON file string and return its recipes. Either the JSON
 * fails parsing, or it fails BeerJSON 2.x validation, or it has no recipes —
 * each case surfaces a human-readable error.
 */
export function parseBeerJsonText(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { recipes: [], error: `Invalid JSON: ${(err as Error).message}` };
  }
  const result = validateBeerJson(parsed);
  if (!result.valid) {
    const first = result.errors[0];
    const detail = first ? `${first.path}: ${first.message}` : "unknown";
    return { recipes: [], error: `Not valid BeerJSON 2.x — ${detail}` };
  }
  const recipes = (parsed as BeerJsonFile).beerjson?.recipes ?? [];
  if (recipes.length === 0) {
    return { recipes: [], error: "File is valid BeerJSON but contains no recipes." };
  }
  return { recipes };
}

/**
 * Open a file dialog filtered to .beerjson, read the file, and parse it.
 * In the desktop build this goes through Tauri's native dialog +
 * filesystem; in a browser build it falls back to a hidden
 * `<input type="file">`. Returns `{ recipes: [] }` with no error if the
 * user cancels.
 */
export async function importBeerJsonFromDisk(): Promise<ImportResult> {
  const { isTauri } = await import("@tauri-apps/api/core");
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "BeerJSON", extensions: ["beerjson", "json"] }],
      title: "Import a .beerjson recipe",
    });
    if (typeof selected !== "string") return { recipes: [] }; // cancelled
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    let raw: string;
    try {
      raw = await readTextFile(selected);
    } catch (err) {
      return { recipes: [], error: `Read failed: ${(err as Error).message}` };
    }
    return parseBeerJsonText(raw);
  }

  // Browser fallback. No accept filter — iOS / iPadOS would grey out
  // .beerjson files in the Files app, and the picker can't be unfiltered
  // selectively. The validator inside parseBeerJsonText surfaces a
  // clear error if the user picks something else.
  const { pickAndReadTextFile } = await import("./browser-fs.ts");
  const picked = await pickAndReadTextFile();
  if (!picked) return { recipes: [] };
  return parseBeerJsonText(picked.text);
}

/**
 * Parse a BeerXML 1.0 document into BeerJSON 2.x recipes via the
 * werb-beerxml-wasm bundle. Lazy-loads the WASM on first call so the
 * ~370 KB binary doesn't enter the cold-start path; cached after that.
 */
export async function parseBeerXmlText(raw: string): Promise<ImportResult> {
  try {
    const wasm = await import(
      "../../../../crates/werb-beerxml-wasm/pkg/werb_beerxml_wasm.js"
    );
    await wasm.default(); // wasm-bindgen init — no-op after the first call
    // The WASM returns a JSON string, not a JS object, so plain
    // `recipe.name` access works without serde_wasm_bindgen's Map
    // gotchas. See the crate's lib.rs for the rationale.
    const recipes = JSON.parse(wasm.parseBeerXmlJson(raw)) as BeerJsonRecipe[];
    if (recipes.length === 0) {
      return { recipes: [], error: "File parsed but contained no recipes." };
    }
    return { recipes };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { recipes: [], error: `BeerXML parse failed: ${detail}` };
  }
}

/**
 * Open a file dialog filtered to .xml/.beerxml, read the file, and
 * convert it to BeerJSON via the WASM parser. Same code path on
 * desktop (Tauri webview) and browser — only the file picker differs.
 * Returns `{ recipes: [] }` with no error if the user cancels.
 */
export async function importBeerXmlFromDisk(): Promise<ImportResult> {
  const { isTauri } = await import("@tauri-apps/api/core");

  let raw: string;
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "BeerXML", extensions: ["beerxml", "xml"] }],
      title: "Import a .beerxml recipe",
    });
    if (typeof selected !== "string") return { recipes: [] }; // cancelled
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    try {
      raw = await readTextFile(selected);
    } catch (err) {
      return { recipes: [], error: `Read failed: ${(err as Error).message}` };
    }
  } else {
    // No accept filter — iOS / iPadOS greys out .beerxml files because
    // that extension isn't a known UTType. The WASM parser surfaces a
    // clear error if the user picks something that isn't XML.
    const { pickAndReadTextFile } = await import("./browser-fs.ts");
    const picked = await pickAndReadTextFile();
    if (!picked) return { recipes: [] };
    raw = picked.text;
  }

  return parseBeerXmlText(raw);
}
