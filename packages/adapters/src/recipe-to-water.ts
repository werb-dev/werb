import type { WaterInput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { toKilograms, toLiters, toMinutes } from "./units.js";

/**
 * Map a BeerJSON Recipe to a WaterInput for @werb/calc.
 *
 * Sources:
 *   - batch_size_l           ← recipe.batch_size
 *   - total_grain_kg         ← Σ fermentable_additions where type === "grain"
 *   - boil_time_min          ← recipe.boil.boil_time
 *   - mash_thickness_l_per_kg ← derived from the first MashStep's infuse
 *                               amount when present (recipe-level override
 *                               wins), else the equipment profile default
 *                               passed via `equipment.mash_thickness_l_per_kg`,
 *                               else a generic 3.0 L/kg fallback.
 *
 * Equipment-derived parameters (grain_absorption, dead spaces, evap rate,
 * shrinkage, kettle→fermenter loss, mash thickness default) are NOT
 * carried in BeerJSON's recipe. The screen must combine the recipe with
 * an equipment profile to get realistic numbers — for now, callers can
 * pass overrides via the `equipment` argument.
 */
export interface EquipmentOverrides {
  grain_absorption_l_per_kg?: number;
  mash_dead_space_l?: number;
  kettle_dead_space_l?: number;
  evaporation_rate_l_per_hour?: number;
  post_boil_shrinkage_pct?: number;
  kettle_to_fermenter_loss_l?: number;
  /** Mash thickness in L/kg — used when the recipe has no mash schedule. */
  mash_thickness_l_per_kg?: number;
  /** BIAB rig: collapse mash + sparge into a full-volume kettle mash. */
  biab?: boolean;
}

export function recipeToWaterInput(
  recipe: BeerJsonRecipe,
  equipment: EquipmentOverrides = {},
): WaterInput {
  const batch_size_l = toLiters(recipe.batch_size);

  const total_grain_kg = recipe.ingredients.fermentable_additions
    .filter((f) => f.type === "grain")
    .reduce((sum, f) => {
      if (!isMass(f.amount)) {
        throw new Error(`fermentable "${f.name}" must use a mass amount`);
      }
      return sum + toKilograms(f.amount);
    }, 0);

  const boil_time_min = recipe.boil?.boil_time
    ? toMinutes(recipe.boil.boil_time)
    : 60;

  const firstStep = recipe.mash?.mash_steps?.[0];
  const mash_thickness_l_per_kg =
    firstStep?.amount && total_grain_kg > 0
      ? toLiters(firstStep.amount) / total_grain_kg
      : equipment.mash_thickness_l_per_kg ?? 3.0;

  // Strip the field from the equipment overrides we forward to the
  // calc — the value above has already absorbed it (recipe-level
  // override took precedence if present), and leaving it on the spread
  // would shadow that with the equipment default.
  const { mash_thickness_l_per_kg: _consumed, ...rest } = equipment;

  return {
    batch_size_l,
    total_grain_kg,
    boil_time_min,
    mash_thickness_l_per_kg,
    ...rest,
  };
}
