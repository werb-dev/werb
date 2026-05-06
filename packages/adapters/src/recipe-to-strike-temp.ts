import type { StrikeTempInput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { toCelsius, toKilograms, toLiters } from "./units.js";

/**
 * Map a BeerJSON Recipe to a StrikeTempInput for @werb/calc.
 *
 * Sources:
 *   - mash_target_c       ← recipe.mash.mash_steps[0].step_temperature
 *   - thickness_l_per_kg  ← step.amount / total_grain_kg (kg of fermentables
 *                            with type === "grain")
 *   - grain_temp_c        ← caller-provided (default 20°C ambient)
 *
 * Returns `null` when the recipe has no mash, no first mash step, no grain,
 * or no infusion volume on that step — strike temp is meaningless without
 * those.
 */
export interface StrikeTempOptions {
  /** Grain temperature at mash-in, °C. Defaults to 20 °C (room temp). */
  grain_temp_c?: number;
  /** Override the grain-to-water specific-heat ratio. Defaults to 0.41. */
  grain_specific_heat_ratio?: number;
}

export function recipeToStrikeTempInput(
  recipe: BeerJsonRecipe,
  options: StrikeTempOptions = {},
): StrikeTempInput | null {
  const firstStep = recipe.mash?.mash_steps?.[0];
  if (!firstStep || !firstStep.amount) return null;

  const totalGrainKg = recipe.ingredients.fermentable_additions
    .filter((f) => f.type === "grain")
    .reduce((sum, f) => (isMass(f.amount) ? sum + toKilograms(f.amount) : sum), 0);
  if (totalGrainKg <= 0) return null;

  return {
    mash_target_c: toCelsius(firstStep.step_temperature),
    grain_temp_c: options.grain_temp_c ?? 20,
    thickness_l_per_kg: toLiters(firstStep.amount) / totalGrainKg,
    ...(options.grain_specific_heat_ratio !== undefined && {
      grain_specific_heat_ratio: options.grain_specific_heat_ratio,
    }),
  };
}
