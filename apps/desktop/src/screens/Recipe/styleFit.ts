import { toSrm, type BeerJsonRecipe } from "@werb/adapters";
import {
  formatSpecificGravity,
  formatSrm,
  type UnitPreferences,
} from "../../data/units-format.ts";

export interface RangeHint {
  /**
   * Three-tier fit:
   *  - "in":   inside the BJCP range, green;
   *  - "near": within 10 % of the range width past either bound, orange;
   *  - "out":  further than that, red.
   */
  status: "in" | "near" | "out";
  /** Pre-formatted BJCP range, e.g. "1.046–1.054" or "≥ 4.5%". */
  range: string;
  /**
   * Raw numbers for the visual gauge. The unit doesn't matter — the
   * gauge only uses these as ratios. `min`/`max` are present only when
   * that bound exists; a one-sided range (e.g. "≥ 4.5 %") leaves the
   * gauge unrendered, falling back to the colour + range text.
   */
  current: number;
  min?: number | undefined;
  max?: number | undefined;
}

/**
 * Compute the BJCP fit for a current value against a [min, max] range.
 * Either bound may be omitted. Returns `null` when there's no current
 * value (e.g. a recipe with no style) or no range at all.
 */
export function rangeHint({
  current,
  min,
  max,
  format,
}: {
  current: number | null | undefined;
  min: number | undefined;
  max: number | undefined;
  format: (v: number) => string;
}): RangeHint | null {
  if (current === null || current === undefined) return null;
  if (min === undefined && max === undefined) return null;
  const range =
    min !== undefined && max !== undefined
      ? `${format(min)}–${format(max)}`
      : min !== undefined
      ? `≥ ${format(min)}`
      : `≤ ${format(max!)}`;
  // Tolerance for "near": 10 % of the range width, or — when only one
  // bound is set — 10 % of the bound itself so a "≥ 4.5 %" comes with
  // a sensible 0.45 % cushion before turning red.
  const width =
    min !== undefined && max !== undefined
      ? max - min
      : Math.abs((min ?? max!) * 0.1);
  const tolerance = Math.abs(width) * 0.1;
  let status: RangeHint["status"];
  if (min !== undefined && current < min) {
    status = current < min - tolerance ? "out" : "near";
  } else if (max !== undefined && current > max) {
    status = current > max + tolerance ? "out" : "near";
  } else {
    status = "in";
  }
  return { status, range, current, min, max };
}

export interface StyleHints {
  og: RangeHint | null;
  fg: RangeHint | null;
  ibu: RangeHint | null;
  abv: RangeHint | null;
  color: RangeHint | null;
  bu_gu: RangeHint | null;
}

/**
 * BU:GU has no first-class BJCP field, so derive a soft envelope from the
 * style's IBU and OG ranges: the least-bitter/most-gravity corner gives the
 * floor, the most-bitter/least-gravity corner the ceiling. Returns undefined
 * bounds when the style lacks either range, leaving the gauge unrendered and
 * the tile value-only.
 */
function deriveBuGuRange(style: BeerJsonRecipe["style"]): {
  min: number | undefined;
  max: number | undefined;
} {
  const ibuMin = style?.international_bitterness_units?.minimum?.value;
  const ibuMax = style?.international_bitterness_units?.maximum?.value;
  const ogMin = style?.original_gravity?.minimum?.value;
  const ogMax = style?.original_gravity?.maximum?.value;
  if (
    ibuMin === undefined ||
    ibuMax === undefined ||
    ogMin === undefined ||
    ogMax === undefined ||
    ogMin <= 1 ||
    ogMax <= 1
  ) {
    return { min: undefined, max: undefined };
  }
  return {
    min: ibuMin / ((ogMax - 1) * 1000),
    max: ibuMax / ((ogMin - 1) * 1000),
  };
}

/**
 * Build the five BJCP-fit hints (OG / FG / IBU / ABV / Color) from a set
 * of current metrics and the recipe's declared style. Shared verbatim by
 * the read-only Recipe screen and the editor's live banner so the two
 * views can never disagree on "in style". Each `current` is whatever the
 * caller already resolved — the read-only screen prefers the file's
 * claimed value and falls back to its compute; the editor passes its live
 * compute. Colour is converted to SRM here so callers stay unit-agnostic.
 */
export function computeStyleHints({
  og,
  fg,
  ibu,
  abv,
  srm,
  buGu,
  style,
  prefs,
}: {
  og: number | null | undefined;
  fg: number | null | undefined;
  ibu: number | null | undefined;
  abv: number | null | undefined;
  srm: number | null | undefined;
  buGu?: number | null | undefined;
  style: BeerJsonRecipe["style"];
  prefs: UnitPreferences;
}): StyleHints {
  const buGuRange = deriveBuGuRange(style);
  return {
    og: rangeHint({
      current: og,
      min: style?.original_gravity?.minimum?.value,
      max: style?.original_gravity?.maximum?.value,
      format: (v) => formatSpecificGravity(v, prefs).display,
    }),
    fg: rangeHint({
      current: fg,
      min: style?.final_gravity?.minimum?.value,
      max: style?.final_gravity?.maximum?.value,
      format: (v) => formatSpecificGravity(v, prefs).display,
    }),
    ibu: rangeHint({
      current: ibu,
      min: style?.international_bitterness_units?.minimum?.value,
      max: style?.international_bitterness_units?.maximum?.value,
      format: (v) => `${v.toFixed(0)} IBU`,
    }),
    abv: rangeHint({
      current: abv,
      min: style?.alcohol_by_volume?.minimum?.value,
      max: style?.alcohol_by_volume?.maximum?.value,
      format: (v) => `${v.toFixed(1)}%`,
    }),
    color: rangeHint({
      current: srm,
      min: style?.color?.minimum ? toSrm(style.color.minimum) : undefined,
      max: style?.color?.maximum ? toSrm(style.color.maximum) : undefined,
      format: (s) => formatSrm(s, prefs).display,
    }),
    bu_gu: rangeHint({
      current: buGu,
      min: buGuRange.min,
      max: buGuRange.max,
      format: (v) => v.toFixed(2),
    }),
  };
}
