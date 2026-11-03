import {
  recipeApparentAttenuationPct,
  recipeToColorInput,
  recipeToGravityInput,
  toSrm,
  type BeerJsonRecipe,
} from "@werb/adapters";
import { computeAbv, computeColor, computeFg, computeGravity } from "@werb/calc";
import type { UnitPreferences } from "./units-format.ts";

/** A recipe figure as the file states it and as Werb computes it. */
export interface TargetValue {
  claimed: number | null;
  /** null when the ingredients can't produce an estimate. */
  computed: number | null;
}

export interface RecipeTargets {
  og: TargetValue;
  fg: TargetValue;
  abv: TargetValue;
  srm: TargetValue;
}

/** The value to show: the file's, else Werb's estimate. */
export function shownValue(v: TargetValue): number | null {
  return v.claimed ?? v.computed;
}

function positive(n: number | null): number | null {
  return n !== null && n > 0 ? n : null;
}

function attempt(fn: () => number): number | null {
  try {
    const n = fn();
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * OG, FG, ABV and color for a recipe, claimed and computed. Same rules as
 * the recipe screen: OG from the grain bill, FG from the yeast attenuation,
 * ABV from the shown OG and FG.
 */
export function recipeTargets(
  recipe: BeerJsonRecipe,
  colorMethod: UnitPreferences["color_method"],
): RecipeTargets {
  // An empty grain bill computes to OG 1.000 and color 0: no estimate.
  const ogRaw = attempt(() => computeGravity(recipeToGravityInput(recipe)).og);
  const ogComputed = ogRaw !== null && ogRaw > 1 ? ogRaw : null;
  const fgComputed =
    ogComputed !== null
      ? attempt(() => computeFg(ogComputed, recipeApparentAttenuationPct(recipe)))
      : null;
  const og: TargetValue = { claimed: recipe.original_gravity?.value ?? null, computed: ogComputed };
  const fg: TargetValue = { claimed: recipe.final_gravity?.value ?? null, computed: fgComputed };
  const ogShown = shownValue(og);
  const fgShown = shownValue(fg);
  return {
    og,
    fg,
    abv: {
      claimed: recipe.alcohol_by_volume?.value ?? null,
      computed:
        ogShown !== null && fgShown !== null
          ? attempt(() => computeAbv(ogShown, fgShown))
          : null,
    },
    srm: {
      claimed: recipe.color_estimate ? toSrm(recipe.color_estimate) : null,
      computed: positive(
        attempt(() => computeColor({ ...recipeToColorInput(recipe), method: colorMethod }).srm),
      ),
    },
  };
}
