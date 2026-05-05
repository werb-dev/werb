import type { GravityInput } from "@werb/types";
import type { BeerJsonRecipe, FermentableAddition } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { toKilograms, toLiters } from "./units.js";

/**
 * Map a BeerJSON Recipe to a GravityInput for @werb/calc.
 *
 * Category mapping (BeerJSON FermentableType → mashed | extract):
 *   grain                       → mashed (efficiency applies)
 *   extract / dry extract       → extract (no loss)
 *   sugar / honey / juice       → extract (no loss; pre-converted sugars)
 *   fruit / other               → extract (conservative default)
 *
 * Skip rule: fermentables without a yield spec or a non-mass amount are
 * dropped (we can't compute gravity contribution without both).
 */
const MASHED_TYPES = new Set<FermentableAddition["type"]>(["grain"]);

export function recipeToGravityInput(recipe: BeerJsonRecipe): GravityInput {
  const batch_size_l = toLiters(recipe.batch_size);
  const efficiency_pct = recipe.efficiency.brewhouse?.value ?? 75;

  const fermentables = recipe.ingredients.fermentable_additions
    .flatMap((f) => {
      if (!isMass(f.amount)) return [];
      const yieldPct = f.yield?.fine_grind?.value;
      if (yieldPct === undefined || yieldPct <= 0) return [];
      return [
        {
          name: f.name,
          mass_kg: toKilograms(f.amount),
          yield_pct: yieldPct,
          category: (MASHED_TYPES.has(f.type) ? "mashed" : "extract") as "mashed" | "extract",
        },
      ];
    });

  if (fermentables.length === 0) {
    // Schema requires minItems:1.
    return {
      batch_size_l,
      efficiency_pct,
      fermentables: [{ mass_kg: 0.001, yield_pct: 0, category: "extract" }],
    };
  }

  return {
    batch_size_l,
    efficiency_pct,
    fermentables: [fermentables[0]!, ...fermentables.slice(1)],
  };
}
