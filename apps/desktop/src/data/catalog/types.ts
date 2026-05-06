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
