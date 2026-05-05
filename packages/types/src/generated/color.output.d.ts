/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Result of a color calculation. Reports both SRM and EBC for convenience.
 */
export interface ColorOutput {
  method: "Morey" | "Daniels" | "Mosher";
  /**
   * Estimated wort color in SRM.
   */
  srm: number;
  /**
   * Estimated wort color in EBC (= SRM × 1.97).
   */
  ebc: number;
  /**
   * Total Malt Color Units (lb·°L/gal). Surfaced for transparency — Morey applies a non-linear curve to this.
   */
  mcu: number;
}
