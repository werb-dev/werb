import type { IbuInput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import {
  toCelsius,
  toGrams,
  toLiters,
  toMinutes,
  toSpecificGravity,
} from "./units.js";

/**
 * Map a BeerJSON Recipe to an IbuInput for @werb/calc.
 *
 * Filtering rule: hop additions are forwarded when their `timing.use`
 * involves thermal contact — `add_to_boil` (the obvious case) and
 * `add_to_whirlpool` (a Werb extension for hopstand additions; see
 * {@link TimingType}). Dry hops, mash hops and packaging hops are
 * ignored — Tinseth assumes thermal isomerisation, which dry/package
 * hops don't undergo, and mash hops are an esoteric corner case.
 *
 * Whirlpool hops carry their hold temperature via `timing.temperature`
 * (defaulting to 80 °C — a common hopstand setpoint when none is
 * specified); the calc engine derates utilization for sub-boil
 * temperatures so a 20-minute hopstand at 80 °C contributes a small
 * but non-zero IBU instead of being silently inflated as full-boil
 * bitterness like the v0.3 path did.
 */
export function recipeToIbuInput(recipe: BeerJsonRecipe): IbuInput {
  const og = recipe.original_gravity
    ? toSpecificGravity(recipe.original_gravity)
    : 1.05; // sane default if missing

  const batch_size_l = toLiters(recipe.batch_size);

  const thermalHops = (recipe.ingredients.hop_additions ?? []).filter(
    (h) =>
      h.timing?.use === "add_to_boil" ||
      h.timing?.use === "add_to_whirlpool",
  );

  // IbuInput requires hops with minItems: 1. If the recipe has no thermal
  // hops, pass a sentinel zero-value entry so the calc returns total_ibu = 0.
  if (thermalHops.length === 0) {
    return {
      method: "Tinseth",
      og,
      batch_size_l,
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
        ? 80 // sane fallback when the brewer didn't specify
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
    hops: [hops[0]!, ...hops.slice(1)],
  };
}
