/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Resulting ion concentrations after dissolving the salts in source water, plus the sulfate-to-chloride ratio and a coarse flavor hint.
 */
export interface WaterAdditionsOutput {
  ca_ppm: number;
  mg_ppm: number;
  na_ppm: number;
  cl_ppm: number;
  so4_ppm: number;
  hco3_ppm: number;
  /**
   * SO4 ÷ Cl. Zero when chloride is zero (avoids divide-by-zero); callers can branch on flavor_hint='none'.
   */
  so4_cl_ratio: number;
  /**
   * Coarse perceptual category derived from so4_cl_ratio. 'none' when chloride is zero.
   */
  flavor_hint: "very_malty" | "malty" | "balanced" | "hoppy" | "very_hoppy" | "none";
}
