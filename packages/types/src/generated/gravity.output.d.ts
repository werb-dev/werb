/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Predicted original gravity for a batch.
 */
export interface GravityOutput {
  /**
   * Predicted original gravity in specific gravity (e.g. 1.054).
   */
  og: number;
  /**
   * Total gravity units (1000 × (SG − 1)). 54 GU corresponds to OG 1.054.
   */
  gravity_units: number;
}
