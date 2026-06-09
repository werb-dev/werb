/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Suggested brewing-salt additions (grams) that move the source water toward the target profile, plus the achieved profile and the residual delta per ion.
 */
export interface WaterSuggestOutput {
  /**
   * Suggested salt amounts in grams. Feed these straight into water-additions to reproduce `achieved`.
   */
  additions: {
    /**
     * Calcium sulfate (CaSO4·2H2O).
     */
    gypsum_g: number;
    /**
     * Calcium chloride (CaCl2·2H2O).
     */
    calcium_chloride_g: number;
    /**
     * Magnesium sulfate (MgSO4·7H2O).
     */
    epsom_g: number;
    /**
     * Sodium chloride (NaCl).
     */
    table_salt_g: number;
    /**
     * Sodium bicarbonate (NaHCO3).
     */
    baking_soda_g: number;
  };
  /**
   * Resulting ion profile after applying the suggested additions to the source.
   */
  achieved: {
    /**
     * Calcium, ppm.
     */
    ca_ppm: number;
    /**
     * Magnesium, ppm.
     */
    mg_ppm: number;
    /**
     * Sodium, ppm.
     */
    na_ppm: number;
    /**
     * Chloride, ppm.
     */
    cl_ppm: number;
    /**
     * Sulfate, ppm.
     */
    so4_ppm: number;
    /**
     * Bicarbonate, ppm.
     */
    hco3_ppm: number;
  };
  /**
   * Per-ion delta (achieved − target), in ppm. Near zero means a close match; positive means the suggestion overshot that ion.
   */
  residual: {
    /**
     * Calcium, ppm.
     */
    ca_ppm: number;
    /**
     * Magnesium, ppm.
     */
    mg_ppm: number;
    /**
     * Sodium, ppm.
     */
    na_ppm: number;
    /**
     * Chloride, ppm.
     */
    cl_ppm: number;
    /**
     * Sulfate, ppm.
     */
    so4_ppm: number;
    /**
     * Bicarbonate, ppm.
     */
    hco3_ppm: number;
  };
}
