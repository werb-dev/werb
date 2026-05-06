import type { ScaleInput, ScaleOutput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { toLiters } from "./units.js";

/**
 * Map a BeerJSON Recipe + an equipment-profile target to a ScaleInput
 * for @werb/calc.
 *
 * Sources:
 *   - from_batch_size_l     ← recipe.batch_size
 *   - from_efficiency_pct   ← recipe.efficiency.brewhouse, default 75
 *   - to_batch_size_l       ← target.batch_size_l
 *   - to_efficiency_pct     ← target.efficiency_pct
 *
 * The target shape is intentionally narrow — same two fields exposed by
 * the equipment profile — so callers can pass a profile directly without
 * a translation layer.
 */
export interface ScaleTarget {
  batch_size_l: number;
  efficiency_pct: number;
}

export function recipeToScaleInput(
  recipe: BeerJsonRecipe,
  target: ScaleTarget,
): ScaleInput {
  return {
    from_batch_size_l: toLiters(recipe.batch_size),
    to_batch_size_l: target.batch_size_l,
    from_efficiency_pct: recipe.efficiency?.brewhouse?.value ?? 75,
    to_efficiency_pct: target.efficiency_pct,
  };
}

/**
 * Apply a [`ScaleOutput`] to a recipe, returning a new recipe with
 * ingredient amounts and stored volumes rescaled. The original recipe
 * is not mutated.
 *
 * What changes:
 *   - `batch_size`               → set to the target volume (liters)
 *   - `efficiency.brewhouse`     → set to the target percentage
 *   - fermentable_additions[].amount.value → × `fermentable_factor`
 *   - hop_additions[].amount.value         → × `volume_factor`
 *   - culture_additions[].amount.value     → × `volume_factor`
 *
 * What is left alone:
 *   - target gravities, color, IBU, ABV — those are intended outcomes
 *     that stay valid when the recipe is scaled correctly.
 *   - mash steps, fermentation steps, pre-boil volume — water amounts
 *     are re-derived by the calc engine from the new batch size; we
 *     don't touch any stored numbers.
 *   - miscellaneous_additions — typically water salts whose ratios are
 *     more about water chemistry than batch volume; left for the
 *     brewer to adjust manually.
 *   - ingredient units — `value` is multiplied, `unit` is preserved
 *     (so a recipe in lb stays in lb, oz stays oz, etc.).
 */
export function applyScale(
  recipe: BeerJsonRecipe,
  scale: ScaleOutput,
): BeerJsonRecipe {
  const { volume_factor, fermentable_factor, to_batch_size_l, to_efficiency_pct } = scale;

  return {
    ...recipe,
    batch_size: { value: to_batch_size_l, unit: "l" },
    efficiency: {
      ...recipe.efficiency,
      brewhouse: { value: to_efficiency_pct, unit: "%" },
    },
    ingredients: {
      ...recipe.ingredients,
      fermentable_additions: recipe.ingredients.fermentable_additions.map((f) => ({
        ...f,
        amount: { ...f.amount, value: f.amount.value * fermentable_factor },
      })),
      ...(recipe.ingredients.hop_additions !== undefined && {
        hop_additions: recipe.ingredients.hop_additions.map((h) => ({
          ...h,
          amount: { ...h.amount, value: h.amount.value * volume_factor },
        })),
      }),
      ...(recipe.ingredients.culture_additions !== undefined && {
        culture_additions: recipe.ingredients.culture_additions.map((c) =>
          c.amount
            ? { ...c, amount: { ...c.amount, value: c.amount.value * volume_factor } }
            : c,
        ),
      }),
    },
  };
}
