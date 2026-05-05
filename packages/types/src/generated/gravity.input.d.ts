/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Input for predicted original gravity. Sums the fermentable contributions, applies brewhouse efficiency to mash-derived sugars only.
 */
export interface GravityInput {
  /**
   * Post-boil wort volume in liters (cooled, into fermenter).
   */
  batch_size_l: number;
  /**
   * Brewhouse efficiency as a percent (e.g. 75 means 75%). Applied only to mash-derived fermentables.
   */
  efficiency_pct: number;
  /**
   * @minItems 1
   */
  fermentables: [FermentableGravityInput, ...FermentableGravityInput[]];
}
export interface FermentableGravityInput {
  name?: string;
  mass_kg: number;
  /**
   * Fine-grind yield as a percent of sucrose. Typical: 75-85% for base malts.
   */
  yield_pct: number;
  /**
   * Whether this fermentable is mashed (efficiency applies) or extract/sugar (no loss).
   */
  category: "mashed" | "extract";
}
