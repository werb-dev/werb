/**
 * Bundled ingredient catalog: typed shapes for the curated lists of
 * malts, hops, yeasts, and miscellaneous additions that pre-fill the
 * recipe editor's typeahead. Values are typical / spec-sheet defaults —
 * brewers override per-recipe.
 */

import type {
  CultureAddition,
  CultureType,
  FermentableAddition,
} from "@werb/adapters";

/** Subset of FermentableAddition.type that we actually populate. */
export type FermentableCategory = FermentableAddition["type"];

export interface FermentableEntry {
  name: string;
  type: FermentableCategory;
  /** Typical color in EBC. Brewer can switch units in the editor. */
  color_ebc: number;
  /** Fine-grind yield percentage. */
  yield_pct: number;
  producer?: string;
  origin?: string;
  notes?: string;
}

export type HopCategory = "bittering" | "aroma" | "dual";

export interface HopEntry {
  name: string;
  /** Typical alpha-acid percentage from the producer's spec. */
  alpha_acid_pct: number;
  hop_type?: HopCategory;
  origin?: string;
  notes?: string;
}

export interface CultureEntry {
  name: string;
  type: CultureType;
  form: CultureAddition["form"];
  producer?: string;
  product_id?: string;
  /** Apparent attenuation percentage from spec sheet. */
  attenuation_pct: number;
  /** Recommended fermentation temperature window, in °C. */
  temp_min_c?: number;
  temp_max_c?: number;
  /**
   * Typical packaged amount (one pack / one vial).
   *  - Dry yeast: usually `g` (11 g for most Fermentis/Lallemand,
   *    10 g for Mangrove Jack's).
   *  - Liquid yeast: `pkg` (one smack-pack / vial / pouch); volume
   *    varies by producer so unit-count is the practical baseline.
   */
  default_amount: number;
  default_amount_unit: "g" | "ml" | "pkg";
  notes?: string;
}

export type MiscCategory =
  | "spice"
  | "fining"
  | "water_agent"
  | "herb"
  | "flavor"
  | "wood"
  | "other";

export type StyleType =
  | "ale"
  | "lager"
  | "wheat"
  | "mead"
  | "cider"
  | "wild"
  | "specialty"
  | "other";

/**
 * BJCP 2021 style entry. Ranges follow the published guideline for
 * each sub-style. SRM is the canonical color unit in the BJCP
 * guidelines; recipes that use EBC will want to convert at display
 * time (1 SRM ≈ 1.97 EBC).
 */
export interface StyleEntry {
  /** Sub-style name as printed in the guidelines (e.g. "American IPA"). */
  name: string;
  /** Category name (e.g. "IPA", "Strong American Ale"). */
  category: string;
  /** Category number 1-34. */
  category_number: number;
  /** Sub-letter A / B / C / D. */
  style_letter: string;
  /** Beer family. */
  type: StyleType;
  og_min: number;
  og_max: number;
  fg_min: number;
  fg_max: number;
  ibu_min: number;
  ibu_max: number;
  srm_min: number;
  srm_max: number;
  abv_min: number;
  abv_max: number;
  notes?: string;
}

export type MiscUse =
  | "add_to_mash"
  | "add_to_boil"
  | "add_to_fermentation"
  | "add_to_package";

export interface MiscEntry {
  name: string;
  type: MiscCategory;
  /** Where in the brew this is typically added. */
  default_use: MiscUse;
  /** Typical addition time in minutes (boil time for boil additions). */
  default_time_min?: number;
  /** Typical amount + unit for a 20 L batch — brewer scales. */
  default_amount: number;
  /** "g", "kg", "ml", or "l". */
  default_amount_unit: "g" | "kg" | "ml" | "l";
  notes?: string;
}
