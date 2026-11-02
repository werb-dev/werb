import type { IbuInput } from "@werb/types";
import { computeGravity } from "@werb/calc";
import type { BeerJsonRecipe, HopAddition } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { recipeToGravityInput } from "./recipe-to-gravity.js";
import {
  toCelsius,
  toGrams,
  toLiters,
  toMinutes,
  toSpecificGravity,
} from "./units.js";

/** Hopstand temperature for whirlpool additions that don't carry one, °C. */
export const DEFAULT_WHIRLPOOL_TEMP_C = 80;

/** Equipment-side inputs to the IBU calc, taken from the active profile. */
export interface IbuEquipment {
  /** Minutes from flameout until the wort is below 80 °C (0 = instant chill). */
  post_boil_minutes_to_80c?: number;
}

/**
 * Hop additions that contribute IBU: `add_to_boil` and
 * `add_to_whirlpool` (a Werb extension for hopstand additions; see
 * {@link TimingType}). Dry, mash and packaging hops don't undergo
 * thermal isomerisation and are left out. `computeIbu` returns one
 * addition per hop matching this predicate, in recipe order.
 */
export function isIbuHop(h: HopAddition): boolean {
  return h.timing?.use === "add_to_boil" || h.timing?.use === "add_to_whirlpool";
}

/**
 * Map a BeerJSON Recipe (+ equipment) to an IbuInput for @werb/calc.
 *
 * Gravity: the OG computed from the grain bill, so IBU follows the
 * fermentables as they are edited. The recipe's stored
 * `original_gravity` is the fallback when there is no computable grain
 * bill, then 1.050.
 *
 * Whirlpool hops carry their hold temperature via `timing.temperature`
 * (default {@link DEFAULT_WHIRLPOOL_TEMP_C}); the calc uses kinetics at
 * that temperature instead of boil utilization.
 */
export function recipeToIbuInput(
  recipe: BeerJsonRecipe,
  equipment: IbuEquipment = {},
): IbuInput {
  const computedOg = computeGravity(recipeToGravityInput(recipe)).og;
  const og =
    computedOg > 1
      ? computedOg
      : recipe.original_gravity
        ? toSpecificGravity(recipe.original_gravity)
        : 1.05;

  const batch_size_l = toLiters(recipe.batch_size);
  const cooling =
    equipment.post_boil_minutes_to_80c !== undefined && equipment.post_boil_minutes_to_80c > 0
      ? { post_boil_minutes_to_80c: equipment.post_boil_minutes_to_80c }
      : {};

  const thermalHops = (recipe.ingredients.hop_additions ?? []).filter(isIbuHop);

  // IbuInput requires hops with minItems: 1. If the recipe has no thermal
  // hops, pass a sentinel zero-value entry so the calc returns total_ibu = 0.
  if (thermalHops.length === 0) {
    return {
      method: "Tinseth",
      og,
      batch_size_l,
      ...cooling,
      hops: [{ amount_g: 0, alpha_acid_pct: 0, time_min: 0 }],
    };
  }

  const hops = thermalHops.map((h) => {
    if (!isMass(h.amount)) {
      throw new Error(
        `hop "${h.name}" amount must be a mass (kg/g/lb/oz), got volume`,
      );
    }
    const isWhirlpool = h.timing.use === "add_to_whirlpool";
    const tempC = h.timing.temperature
      ? toCelsius(h.timing.temperature)
      : isWhirlpool
        ? DEFAULT_WHIRLPOOL_TEMP_C
        : undefined;
    return {
      name: h.name,
      amount_g: toGrams(h.amount),
      alpha_acid_pct: h.alpha_acid?.value ?? 0,
      time_min: h.timing.time ? toMinutes(h.timing.time) : 0,
      form: h.form ?? ("pellet" as const),
      ...(tempC !== undefined ? { temperature_c: tempC } : {}),
    };
  });

  return {
    method: "Tinseth",
    og,
    batch_size_l,
    ...cooling,
    hops: [hops[0]!, ...hops.slice(1)],
  };
}
