/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Input for beer color calculation. Decoupled from BeerJSON: an adapter projects a Recipe's fermentable bill into this normalized shape.
 */
export interface ColorInput {
  /**
   * Color estimation method. Morey is the de facto homebrew standard.
   */
  method?: "Morey" | "Daniels" | "Mosher";
  /**
   * Post-boil wort volume in liters (cooled, into fermenter).
   */
  batch_size_l: number;
  /**
   * @minItems 1
   */
  fermentables: [FermentableColorInput, ...FermentableColorInput[]];
}
export interface FermentableColorInput {
  /**
   * Optional, for traceability.
   */
  name?: string;
  /**
   * Fermentable mass in kg.
   */
  mass_kg: number;
  /**
   * Fermentable color in SRM. Adapter must convert EBC/Lovibond inputs.
   */
  color_srm: number;
}
