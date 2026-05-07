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
 * Compose a human-readable status message describing skipped duplicates.
 * Returns `undefined` when nothing was skipped, so callers can pass the
 * result through to UI without conditionals.
 */
export function skippedMessage(skipped: BeerJsonRecipe[]): string | undefined {
  if (skipped.length === 0) return undefined;
  const names = skipped.map((r) => `"${r.name}"`).join(", ");
  return `Skipped ${skipped.length} duplicate${skipped.length === 1 ? "" : "s"} already in your library: ${names}. Use the "+" on a card to make an intentional copy.`;
}
