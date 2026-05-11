import type { YeastPitchInput } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { toLiters, toSpecificGravity } from "./units.js";

/**
 * Map a BeerJSON Recipe to a YeastPitchInput for @werb/calc.
 *
 * Sources:
 *   - og_sg          ← recipe.original_gravity (converted to specific
 *                       gravity if expressed in Plato/Brix). Falls back
 *                       to a caller-provided override when the recipe
 *                       doesn't carry a target OG yet.
 *   - beer_volume_l  ← recipe.batch_size, unless overridden.
 *   - style_type     ← derived from the first culture_addition's type +
 *                       the OG threshold (high-gravity bumps the rate).
 *                       Caller can override.
 *   - yeast_form     ← first culture_addition.form ("dry" or "liquid"),
 *                       falling back to "dry" when not specified.
 *
 * Returns `null` when there's no way to derive a usable OG — pitch rate
 * is meaningless without one.
 */
export interface YeastPitchOptions {
  /** Override the brewer's pack count (defaults to 1). */
  yeast_pack_count?: number;
  /** Override the pack-size cell count, in billions. */
  cells_per_pack_billion?: number;
  /** Override viability, 0-100. */
  viability_pct?: number;
  /** Force a style classification even if the culture says otherwise. */
  style_type?: YeastPitchInput["style_type"];
  /** Override beer volume (e.g. you packaged less than batch_size). */
  beer_volume_l?: number;
  /** Override OG when the recipe doesn't carry one. */
  og_sg?: number;
}

const HIGH_GRAVITY_THRESHOLD = 1.075;

function deriveStyleType(
  recipe: BeerJsonRecipe,
  ogSg: number,
): YeastPitchInput["style_type"] {
  const culture = recipe.ingredients.culture_additions?.[0];
  const isLager = culture?.type === "lager";
  if (ogSg > HIGH_GRAVITY_THRESHOLD) return isLager ? "lager" : "high_gravity";
  return isLager ? "lager" : "ale";
}

function deriveYeastForm(
  recipe: BeerJsonRecipe,
): YeastPitchInput["yeast_form"] {
  const culture = recipe.ingredients.culture_additions?.[0];
  // BeerJSON's `form` enum has more granularity (slant, culture, dregs)
  // than the pitch-rate calc cares about. Anything not explicitly dry
  // is treated as liquid for the conservative-viability default.
  if (culture?.form === "dry") return "dry";
  return "liquid";
}

export function recipeToYeastPitchInput(
  recipe: BeerJsonRecipe,
  options: YeastPitchOptions = {},
): YeastPitchInput | null {
  const ogSg = options.og_sg
    ?? (recipe.original_gravity ? toSpecificGravity(recipe.original_gravity) : null);
  if (ogSg === null) return null;

  const styleType = options.style_type ?? deriveStyleType(recipe, ogSg);
  const yeastForm = deriveYeastForm(recipe);

  return {
    og_sg: ogSg,
    beer_volume_l: options.beer_volume_l ?? toLiters(recipe.batch_size),
    style_type: styleType,
    yeast_form: yeastForm,
    ...(options.yeast_pack_count !== undefined && {
      yeast_pack_count: options.yeast_pack_count,
    }),
    ...(options.cells_per_pack_billion !== undefined && {
      cells_per_pack_billion: options.cells_per_pack_billion,
    }),
    ...(options.viability_pct !== undefined && {
      viability_pct: options.viability_pct,
    }),
  };
}
