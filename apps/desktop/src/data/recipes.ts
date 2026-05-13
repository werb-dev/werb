import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { validateBeerJson } from "@werb/validate";
import type { StorageBackend } from "../storage/index.ts";
import { isTauri } from "./runtime.ts";
import { WerbError } from "./errors.ts";
// Statically imported so triggering the file picker doesn't cross a
// microtask boundary — iOS Safari requires `input.click()` to fire in
// the same task as the user's tap.
import { pickAndReadTextFile } from "./browser-fs.ts";

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

/**
 * Minimal valid BeerJSON recipe — used by the Library's "+ New recipe"
 * button as the starting point for from-scratch authoring. The caller
 * is expected to pass batch size + efficiency from the active equipment
 * profile when one exists; the fallbacks (20 L, 75 %) are the homebrew
 * baseline used for users who haven't set up a profile yet.
 */
export function createBlankRecipe(opts?: {
  batch_size_l?: number;
  efficiency_pct?: number;
}): BeerJsonRecipe {
  return {
    name: "New recipe",
    type: "all grain",
    author: "",
    batch_size: { value: opts?.batch_size_l ?? 20, unit: "l" },
    efficiency: {
      brewhouse: { value: opts?.efficiency_pct ?? 75, unit: "%" },
    },
    ingredients: {
      fermentable_additions: [],
      hop_additions: [],
      culture_additions: [],
      miscellaneous_additions: [],
    },
    boil: { boil_time: { value: 60, unit: "min" } },
  };
}

// ─── Import from disk (Tauri only) ────────────────────────────────────────

export interface ImportResult {
  recipes: BeerJsonRecipe[];
  error?: WerbError;
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
    return {
      recipes: [],
      error: new WerbError("import.invalid_json", { detail: (err as Error).message }),
    };
  }
  const result = validateBeerJson(parsed);
  if (!result.valid) {
    const first = result.errors[0];
    const detail = first ? `${first.path}: ${first.message}` : "unknown";
    return { recipes: [], error: new WerbError("import.not_beerjson", { detail }) };
  }
  const recipes = (parsed as BeerJsonFile).beerjson?.recipes ?? [];
  if (recipes.length === 0) {
    return { recipes: [], error: new WerbError("import.no_recipes_beerjson") };
  }
  return { recipes };
}

/**
 * Open a file dialog, read whatever the user picks, and route it
 * through the right parser based on a content sniff. Supports
 * BeerJSON 2.x, BeerXML 1.0, and joliebulle v4 exports out of one
 * door — the user never has to know which one their file is.
 *
 * On desktop this goes through Tauri's native dialog with a filter
 * covering every supported extension; in a browser build it falls
 * back to a hidden `<input type="file">` with no filter (iOS / iPadOS
 * would otherwise grey out files the picker doesn't recognize).
 *
 * Returns `{ recipes: [] }` with no error if the user cancels.
 */
export async function importRecipesFromDisk(): Promise<ImportResult> {
  if (isTauri()) {
    return importRecipesViaTauri();
  }
  // Browser fallback. pickAndReadTextFile() must be called in the same
  // task as the user's tap on iOS, so this is a plain sync call with
  // no awaits in front of it.
  const picker = pickAndReadTextFile();
  const picked = await picker;
  if (!picked) return { recipes: [] };
  return dispatchByContent(picked.text);
}

async function importRecipesViaTauri(): Promise<ImportResult> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    filters: [
      { name: "Recipes", extensions: ["beerjson", "beerxml", "xml", "json"] },
    ],
    title: "Import a recipe",
  });
  if (typeof selected !== "string") return { recipes: [] }; // cancelled
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  let raw: string;
  try {
    raw = await readTextFile(selected);
  } catch (err) {
    return {
      recipes: [],
      error: new WerbError("import.read_failed", { detail: (err as Error).message }),
    };
  }
  return dispatchByContent(raw);
}

/**
 * Sniff the file's content and route to the right parser. The
 * detection is cheap — first non-whitespace byte distinguishes XML
 * from JSON, and within JSON the top-level shape distinguishes
 * joliebulle from BeerJSON.
 */
async function dispatchByContent(raw: string): Promise<ImportResult> {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("<")) {
    return parseBeerXmlText(raw);
  }
  if (looksLikeJoliebulle(raw)) {
    return parseJoliebulleText(raw);
  }
  return parseBeerJsonText(raw);
}

/**
 * Parse a BeerXML 1.0 document into BeerJSON 2.x recipes via the
 * werb-beerxml-wasm bundle. Lazy-loads the WASM on first call so the
 * ~370 KB binary doesn't enter the cold-start path; cached after that.
 */
export async function parseBeerXmlText(raw: string): Promise<ImportResult> {
  try {
    const wasm = await loadWasm();
    const recipes = JSON.parse(wasm.parseBeerXmlJson(raw)) as BeerJsonRecipe[];
    if (recipes.length === 0) {
      return { recipes: [], error: new WerbError("import.no_recipes_beerxml") };
    }
    return { recipes };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { recipes: [], error: new WerbError("import.beerxml_parse_failed", { detail }) };
  }
}

/**
 * Parse a joliebulle v4 library export into BeerJSON 2.x recipes
 * via the same WASM bundle that handles BeerXML. Joliebulle saves
 * its whole library as a single `.json` file with a custom shape;
 * we sniff for that shape inside [`parseBeerJsonText`] and route
 * here so the picker can stay a plain "Import BeerJSON" entry point.
 */
export async function parseJoliebulleText(raw: string): Promise<ImportResult> {
  try {
    const wasm = await loadWasm();
    const recipes = JSON.parse(wasm.parseJoliebulleJson(raw)) as BeerJsonRecipe[];
    if (recipes.length === 0) {
      return { recipes: [], error: new WerbError("import.no_recipes_beerxml") };
    }
    return { recipes };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { recipes: [], error: new WerbError("import.beerxml_parse_failed", { detail }) };
  }
}

// WASM is loaded lazily on the first call of any importer and cached
// across subsequent calls. The wasm-bindgen `default()` call is a
// no-op after the first invocation, but the dynamic import alone
// avoids pulling the binary into the cold-start path.
type ImportWasm = typeof import(
  "../../../../crates/werb-beerxml-wasm/pkg/werb_beerxml_wasm.js"
);
let wasmCache: ImportWasm | null = null;
async function loadWasm(): Promise<ImportWasm> {
  if (wasmCache) return wasmCache;
  const wasm = await import(
    "../../../../crates/werb-beerxml-wasm/pkg/werb_beerxml_wasm.js"
  );
  await wasm.default();
  wasmCache = wasm;
  return wasm;
}

/**
 * Cheap JS-side sniff for joliebulle v4 exports: a top-level
 * `recipes` array AND no `beerjson` wrapper key. Used by
 * [`parseBeerJsonText`] to decide whether to delegate to the
 * joliebulle parser before falling through to BeerJSON validation.
 * Avoids loading WASM for every BeerJSON import.
 */
function looksLikeJoliebulle(raw: string): boolean {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return (
      obj !== null &&
      typeof obj === "object" &&
      Array.isArray((obj as { recipes?: unknown }).recipes) &&
      !("beerjson" in obj)
    );
  } catch {
    return false;
  }
}

