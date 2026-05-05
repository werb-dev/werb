import type { IbuInput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { toGrams, toLiters, toMinutes, toSpecificGravity } from "./units.js";

/**
 * Map a BeerJSON Recipe to an IbuInput for @werb/calc.
 *
 * Filtering rule: only hop additions whose `timing.use === "add_to_boil"`
 * are passed to the IBU calc. Dry hops, mash hops and packaging hops are
 * ignored (Tinseth assumes thermal isomerisation in the boil).
 *
 * Ambiguity: BeerXML's USE="Aroma" is often a whirlpool addition; our
 * importer maps it to "add_to_boil" and preserves TIME. This means
 * whirlpool hops will be treated as boil-time hops here, inflating the
 * estimate vs. tools that zero-out whirlpool. The recipe view should
 * surface this as "claimed vs computed" so the brewer can reconcile.
 */
export function recipeToIbuInput(recipe: BeerJsonRecipe): IbuInput {
  const og = recipe.original_gravity
    ? toSpecificGravity(recipe.original_gravity)
    : 1.05; // sane default if missing

  const batch_size_l = toLiters(recipe.batch_size);

  const boilHops = (recipe.ingredients.hop_additions ?? []).filter(
    (h) => h.timing?.use === "add_to_boil",
  );

  // IbuInput requires hops with minItems: 1. If the recipe has no boil hops,
  // pass a sentinel zero-value entry so the calc returns total_ibu = 0.
  if (boilHops.length === 0) {
    return {
      method: "Tinseth",
      og,
      batch_size_l,
      hops: [{ amount_g: 0, alpha_acid_pct: 0, time_min: 0 }],
    };
  }

  const hops = boilHops.map((h) => {
    if (!isMass(h.amount)) {
      throw new Error(
        `hop "${h.name}" amount must be a mass (kg/g/lb/oz), got volume`,
      );
    }
    return {
      name: h.name,
      amount_g: toGrams(h.amount),
      alpha_acid_pct: h.alpha_acid?.value ?? 0,
      time_min: h.timing.time ? toMinutes(h.timing.time) : 0,
      form: h.form ?? ("pellet" as const),
    };
  });

  return {
    method: "Tinseth",
    og,
    batch_size_l,
    hops: [hops[0]!, ...hops.slice(1)],
  };
}
