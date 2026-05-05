import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { validateBeerJson } from "@werb/validate";

/**
 * Recipe data layer.
 *
 * For now: pulls every `*.beerjson` file under `/examples/` at build time via
 * Vite's import.meta.glob. This lets the library screen render real recipes
 * without any IO — useful while we don't yet have Tauri fs wired up. When we
 * add file-picker / working-directory selection, this module is the seam:
 * swap the glob import for a Tauri fs read and everything downstream still
 * works.
 *
 * Every file is validated against BeerJSON 2.x at load. Invalid files are
 * skipped with a console warning so a malformed recipe never reaches the UI.
 */

interface LoadedRecipe {
  /** Stable ID derived from the file basename (no extension). */
  id: string;
  /** Source file path, useful for debugging. */
  path: string;
  recipe: BeerJsonRecipe;
}

const rawFiles = import.meta.glob("../../../../examples/*.beerjson", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function basename(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.beerjson$/, "");
}

export const RECIPES: LoadedRecipe[] = Object.entries(rawFiles)
  .flatMap(([path, raw]) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error(`[recipes] ${path}: invalid JSON`, err);
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
    const recipes = (parsed as BeerJsonFile).beerjson?.recipes ?? [];
    return recipes.map((recipe, index) => ({
      id: recipes.length === 1 ? basename(path) : `${basename(path)}-${index}`,
      path,
      recipe,
    }));
  })
  .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));

export function getRecipe(id: string): LoadedRecipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
