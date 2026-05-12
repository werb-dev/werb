import type { BeerJsonRecipe } from "@werb/adapters";
import type { StoredRecipe } from "./recipes.ts";

/**
 * Split incoming recipes into ones that should be imported and ones
 * already present in the library. Identity is the recipe's `name`,
 * trimmed and lowercased — the typical way two imports of the same
 * `.beerxml` collide. Brewers who explicitly want a copy use the
 * library card's "+" action, which bypasses this check.
 */
export function partitionForImport(
  incoming: BeerJsonRecipe[],
  existing: StoredRecipe[],
): { fresh: BeerJsonRecipe[]; skipped: BeerJsonRecipe[] } {
  if (incoming.length === 0) return { fresh: [], skipped: [] };
  const existingKeys = new Set(
    existing.map((s) => s.recipe.name.trim().toLowerCase()),
  );
  const fresh: BeerJsonRecipe[] = [];
  const skipped: BeerJsonRecipe[] = [];
  for (const r of incoming) {
    if (existingKeys.has(r.name.trim().toLowerCase())) skipped.push(r);
    else fresh.push(r);
  }
  return { fresh, skipped };
}

/**
 * Structured "skipped duplicates" notice. Returns `null` when nothing
 * was skipped. The UI layer formats with t() since this module is pure
 * (no React access). Caller pattern:
 *
 *   const skip = skippedSummary(skipped);
 *   const info = skip
 *     ? t("library.import.skipped", { count: skip.count, names: skip.names })
 *     : undefined;
 */
export function skippedSummary(
  skipped: BeerJsonRecipe[],
): { count: number; names: string } | null {
  if (skipped.length === 0) return null;
  return {
    count: skipped.length,
    names: skipped.map((r) => `"${r.name}"`).join(", "),
  };
}
