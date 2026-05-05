import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { validateBeerJson } from "@werb/validate";

/**
 * Recipe data layer.
 *
 * Two sources today:
 *   1. BUNDLED — examples/*.beerjson, glob-imported at build time. Always
 *      available, used until the user picks a working directory.
 *   2. DISK — a Tauri-fs-loaded directory of .beerjson files. Activated by
 *      the user via the Library "Open folder" action. Persisted across
 *      launches via localStorage.
 *
 * Both sources produce the same `LoadedRecipe` shape so the rest of the app
 * doesn't care where a recipe came from.
 */

export interface LoadedRecipe {
  /** Stable ID derived from the file basename (no extension). */
  id: string;
  /** Source file path, useful for debugging. */
  path: string;
  recipe: BeerJsonRecipe;
}

// ─── Bundled examples (Vite glob, eager) ──────────────────────────────────

const bundledRaw = import.meta.glob("../../../../examples/*.beerjson", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function basename(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.beerjson$/, "");
}

function parseAndCollect(
  path: string,
  raw: string,
  warn: (msg: string, errors?: unknown) => void = console.warn,
): LoadedRecipe[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    warn(`[recipes] ${path}: invalid JSON — ${(err as Error).message}`);
    return [];
  }
  const result = validateBeerJson(parsed);
  if (!result.valid) {
    warn(
      `[recipes] ${path}: failed BeerJSON 2.x validation, skipping`,
      result.errors.slice(0, 5),
    );
    return [];
  }
  const recipes = (parsed as BeerJsonFile).beerjson?.recipes ?? [];
  return recipes.map((recipe, index) => ({
    id: recipes.length === 1 ? basename(path) : `${basename(path)}-${index}`,
    path,
    recipe,
  }));
}

export const BUNDLED_RECIPES: LoadedRecipe[] = Object.entries(bundledRaw)
  .flatMap(([path, raw]) => parseAndCollect(path, raw))
  .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));

// ─── Disk loader (Tauri only) ─────────────────────────────────────────────

export interface DiskLoadResult {
  recipes: LoadedRecipe[];
  /** Files that failed parse or validation, surfaced to the UI. */
  skipped: { path: string; reason: string }[];
}

export async function loadRecipesFromDirectory(directory: string): Promise<DiskLoadResult> {
  const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(directory);
  const files = entries.filter((e) => e.isFile && e.name.endsWith(".beerjson"));

  const recipes: LoadedRecipe[] = [];
  const skipped: DiskLoadResult["skipped"] = [];

  for (const f of files) {
    const filePath = `${directory}/${f.name}`;
    let raw: string;
    try {
      raw = await readTextFile(filePath);
    } catch (err) {
      skipped.push({ path: filePath, reason: `read error: ${(err as Error).message}` });
      continue;
    }
    let firstError: string | null = null;
    const collected = parseAndCollect(filePath, raw, (msg, errors) => {
      if (firstError) return;
      const tail = errors ? ` (${JSON.stringify(errors).slice(0, 160)})` : "";
      firstError = `${msg.replace(/^\[recipes\] /, "")}${tail}`;
    });
    if (collected.length === 0 && firstError) {
      skipped.push({ path: filePath, reason: firstError });
    }
    recipes.push(...collected);
  }

  recipes.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
  return { recipes, skipped };
}

// ─── Folder picker ────────────────────────────────────────────────────────

export async function pickWorkingDirectory(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Pick a folder of .beerjson recipes",
  });
  return typeof selected === "string" ? selected : null;
}
