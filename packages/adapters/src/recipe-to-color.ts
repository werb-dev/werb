import type { ColorInput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { toKilograms, toLiters, toSrm } from "./units.js";

/**
 * Map a BeerJSON Recipe to a ColorInput for @werb/calc.
 *
 * Filtering rule: only fermentables with both a mass amount and a color
 * value are considered. Volume-based extracts (e.g. liquid honey by L)
 * and fermentables with no color spec are skipped — they would either
 * require a unit conversion we don't support or contribute zero color.
 */
export function recipeToColorInput(recipe: BeerJsonRecipe): ColorInput {
  const batch_size_l = toLiters(recipe.batch_size);

  const fermentables = recipe.ingredients.fermentable_additions
    .flatMap((f) => {
      if (!isMass(f.amount) || f.color === undefined) return [];
      return [
        {
          name: f.name,
          mass_kg: toKilograms(f.amount),
          color_srm: toSrm(f.color),
        },
      ];
    });

  if (fermentables.length === 0) {
    // Schema requires minItems:1; pass a sentinel zero entry.
    return {
      method: "Morey",
      batch_size_l,
      fermentables: [{ mass_kg: 0.001, color_srm: 0 }],
    };
  }

  return {
    method: "Morey",
    batch_size_l,
    fermentables: [fermentables[0]!, ...fermentables.slice(1)],
  };
}
