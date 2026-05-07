import type { CarbonationInput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { toLiters } from "./units.js";

/**
 * Map a BeerJSON Recipe to a CarbonationInput for @werb/calc.
 *
 * Sources:
 *   - beer_volume_l        ← recipe.batch_size (the brewer can override
 *                              if some volume was lost to trub or yeast cake)
 *   - target_volumes_co2   ← caller-provided, with a sensible style default
 *                              upstream (BJCP range midpoint or 2.4 vols)
 *   - package_temp_c       ← caller-provided. We don't have the actual fermenter
 *                              high-temp on the recipe, so the UI prompts.
 *   - serving_temp_c       ← caller-provided, defaults to 4 °C downstream.
 *
 * Style-based default for target volumes: midpoint of the style's range if
 * present (BJCP styles ship with vols in their guide entry), else 2.4 vols
 * (a reasonable middle-of-the-road American/Belgian-light setting).
 */
export interface CarbonationOptions {
  target_volumes_co2: number;
  package_temp_c: number;
  serving_temp_c?: number;
  /** Override the recipe's batch size (e.g. you packaged less than planned). */
  beer_volume_l?: number;
}

export function recipeToCarbonationInput(
  recipe: BeerJsonRecipe,
  options: CarbonationOptions,
): CarbonationInput {
  return {
    target_volumes_co2: options.target_volumes_co2,
    beer_volume_l: options.beer_volume_l ?? toLiters(recipe.batch_size),
    package_temp_c: options.package_temp_c,
    ...(options.serving_temp_c !== undefined && {
      serving_temp_c: options.serving_temp_c,
    }),
  };
}
