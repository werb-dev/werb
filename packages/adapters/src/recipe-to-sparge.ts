import type { SpargeInput } from "@werb/types";
import type { BeerJsonRecipe, MashStep } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { toCelsius, toKilograms } from "./units.js";

/** Sparge water temperature when nothing else sets it (fly sparge, °C). */
export const DEFAULT_SPARGE_TEMP_C = 75;

/** Mash temperature assumed when the recipe has no mash rest, °C. */
const DEFAULT_MASH_TEMP_C = 67;

/** Steps that move wort out of the tun rather than hold a rest. */
const NON_REST_STEP_TYPES: ReadonlySet<MashStep["type"]> = new Set([
  "sparge",
  "drain mash tun",
]);

/** A BeerJSON mash step that describes the sparge, not a mash rest. */
export function isSpargeStep(step: MashStep): boolean {
  return step.type === "sparge";
}

/** Equipment-profile fields the sparge plan needs. */
export interface SpargeEquipment {
  method?: "batch" | "fly";
  grain_absorption_l_per_kg?: number;
  mash_dead_space_l?: number;
  /** Batch sparge only: splits the water into runs that fit. */
  mash_tun_capacity_l?: number;
}

/**
 * Map a BeerJSON Recipe to a SpargeInput for @werb/calc.
 *
 * Sources:
 *   - sparge_water_l ← caller (computeWater's `sparge_water_l`)
 *   - grain_kg       ← Σ fermentable_additions where type === "grain"
 *   - mash_temp_c    ← last mash rest: end_temperature, else
 *                      step_temperature; 67 °C without one
 *   - the rest       ← equipment profile, method defaulting to "fly"
 */
export function recipeToSpargeInput(
  recipe: BeerJsonRecipe,
  spargeWaterL: number,
  equipment: SpargeEquipment = {},
): SpargeInput {
  const grain_kg = recipe.ingredients.fermentable_additions
    .filter((f) => f.type === "grain")
    .reduce((sum, f) => (isMass(f.amount) ? sum + toKilograms(f.amount) : sum), 0);

  const lastRest = (recipe.mash?.mash_steps ?? [])
    .filter((s) => !NON_REST_STEP_TYPES.has(s.type))
    .at(-1);
  const mash_temp_c = lastRest
    ? toCelsius(lastRest.end_temperature ?? lastRest.step_temperature)
    : DEFAULT_MASH_TEMP_C;

  const { method = "fly", ...rest } = equipment;
  return {
    method,
    sparge_water_l: Math.max(0, spargeWaterL),
    grain_kg,
    mash_temp_c,
    ...rest,
  };
}
