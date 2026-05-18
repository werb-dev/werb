import type { BeerJsonRecipe } from "./beerjson.js";

/**
 * Apparent attenuation, percent, used by computeFg.
 *
 * Source of truth, in priority order:
 *  1. the highest attenuation declared on any culture_addition (a
 *     blend's final apparent attenuation tracks the most attenuative
 *     strain, e.g. saison + brett finish);
 *  2. 75% — a neutral ale workhorse default (US-05, Notty, WLP001 all
 *     land within ±3 of it).
 *
 * Returning a sensible default rather than null lets the FG/ABV
 * estimates always appear; a brewer who needs precision will pick
 * the actual strain from the catalog, which writes a real
 * attenuation back onto the recipe.
 */
const DEFAULT_APPARENT_ATTENUATION_PCT = 75;

export function recipeApparentAttenuationPct(recipe: BeerJsonRecipe): number {
  const cultures = recipe.ingredients.culture_additions ?? [];
  const values = cultures
    .map((c) => c.attenuation?.value)
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (values.length === 0) return DEFAULT_APPARENT_ATTENUATION_PCT;
  return Math.max(...values);
}
