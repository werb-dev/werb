import type { ScaleInput, ScaleOutput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { isMass } from "./beerjson.js";
import { toKilograms, toLiters } from "./units.js";

/**
 * Approximate volume taken up by 1 kg of crushed grain in a mash, in
 * liters. Derived from the homebrew rule of thumb that 1 lb of grain
 * occupies ~0.32 qt of mash space (≈0.67 L/kg). Used to estimate how
 * much water actually fits in a mash tun of a given capacity.
 */
const GRAIN_VOLUME_L_PER_KG = 0.67;

/**
 * Reserve a fraction of the mash tun's usable capacity for headspace
 * (foam, stir-room). 15% is a conservative homebrew default.
 */
const MASH_TUN_HEADSPACE_FRACTION = 0.15;

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
 *   - fermentation steps, pre-boil volume — water amounts are
 *     re-derived by the calc engine from the new batch size; we don't
 *     touch any stored numbers.
 *   - miscellaneous_additions — typically water salts whose ratios are
 *     more about water chemistry than batch volume; left for the
 *     brewer to adjust manually.
 *   - ingredient units — `value` is multiplied, `unit` is preserved
 *     (so a recipe in lb stays in lb, oz stays oz, etc.).
 *
 * Note on mash steps: the recipe's first mash step's `amount` is what
 * the water calc reads as strike-water source-of-truth (mash thickness
 * = step amount ÷ total grain). Failing to scale it means the strike
 * water stays at the original recipe's value while grain shrinks, so
 * the apparent thickness explodes and sparge eats the difference.
 * `amount` on every mash step is therefore scaled by `volume_factor`.
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
    ...(recipe.mash !== undefined && {
      mash: {
        ...recipe.mash,
        mash_steps: recipe.mash.mash_steps.map((s) =>
          s.amount
            ? { ...s, amount: { ...s.amount, value: s.amount.value * volume_factor } }
            : s,
        ),
      },
    }),
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

/**
 * Result of [`fitMashToTun`]: the (possibly modified) recipe plus a
 * record of any cap applied to strike water. `capped` is `null` when
 * no clamp was needed.
 */
export interface MashFitResult {
  recipe: BeerJsonRecipe;
  capped: { from_l: number; to_l: number } | null;
}

/**
 * Clamp the recipe's first mash step's strike water volume to fit a
 * given mash tun. Useful as a follow-up to [`applyScale`] when a
 * scaled recipe's intended thickness would overflow the brewer's
 * mash tun — typically when scaling a commercial-sized recipe down
 * to a homebrew rig.
 *
 * The cap is computed as:
 *
 *   max_strike_l =
 *     (mash_tun.capacity_l − mash_tun.dead_space_l) × (1 − headspace)
 *     − total_grain_kg × GRAIN_VOLUME_L_PER_KG
 *
 * If the recipe's current strike water is already at or below this
 * limit, the recipe passes through untouched (`capped: null`). Only
 * the *first* mash step is clamped — later infusion steps are left
 * alone since the tun is already partially drained between rests in
 * practice.
 */
export function fitMashToTun(
  recipe: BeerJsonRecipe,
  mashTun: { capacity_l: number; dead_space_l?: number | undefined },
): MashFitResult {
  if (!recipe.mash || recipe.mash.mash_steps.length === 0) {
    return { recipe, capped: null };
  }
  const firstStep = recipe.mash.mash_steps[0];
  if (!firstStep?.amount) {
    return { recipe, capped: null };
  }

  const grainKg = recipe.ingredients.fermentable_additions
    .filter((f) => f.type === "grain")
    .reduce((sum, f) => {
      if (!isMass(f.amount)) return sum;
      return sum + toKilograms(f.amount);
    }, 0);

  const grainVolumeL = grainKg * GRAIN_VOLUME_L_PER_KG;
  const usableL = mashTun.capacity_l - (mashTun.dead_space_l ?? 0);
  const maxStrikeL = Math.max(0, usableL * (1 - MASH_TUN_HEADSPACE_FRACTION) - grainVolumeL);

  const currentStrikeL = toLiters(firstStep.amount);

  if (currentStrikeL <= maxStrikeL || maxStrikeL <= 0) {
    return { recipe, capped: null };
  }

  return {
    recipe: {
      ...recipe,
      mash: {
        ...recipe.mash,
        mash_steps: recipe.mash.mash_steps.map((s, i) =>
          i === 0 && s.amount
            ? { ...s, amount: { ...s.amount, value: maxStrikeL } }
            : s,
        ),
      },
    },
    capped: { from_l: currentStrikeL, to_l: maxStrikeL },
  };
}
