/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Multipliers for rescaling a recipe to a new batch size and efficiency. The caller applies these factors to ingredient amounts; the calc engine itself does no recipe mutation.
 */
export interface ScaleOutput {
  /**
   * Multiplier for any quantity that scales linearly with batch volume — hops, yeast, miscs, water-derived volumes.
   */
  volume_factor: number;
  /**
   * Multiplier for fermentable additions: volume_factor × (from_efficiency / to_efficiency). Lower target efficiency means more grain to hit the same OG.
   */
  fermentable_factor: number;
  /**
   * Echoed target batch size, in liters.
   */
  to_batch_size_l: number;
  /**
   * Echoed target brewhouse efficiency, percent.
   */
  to_efficiency_pct: number;
}
