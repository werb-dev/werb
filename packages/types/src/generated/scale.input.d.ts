/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Normalized input for computing how to rescale a recipe from one batch size and efficiency to another. Decoupled from BeerJSON: an adapter extracts these fields from a Recipe + Equipment profile.
 */
export interface ScaleInput {
  /**
   * Original recipe's batch size, in liters.
   */
  from_batch_size_l: number;
  /**
   * Target batch size after scaling, in liters.
   */
  to_batch_size_l: number;
  /**
   * Original recipe's brewhouse efficiency, percent.
   */
  from_efficiency_pct: number;
  /**
   * Target brewhouse efficiency after scaling, percent.
   */
  to_efficiency_pct: number;
}
