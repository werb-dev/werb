/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Source + target water ion profiles + total water volume. Drives the inverse calc that suggests brewing-salt additions to move source toward target.
 */
export interface WaterSuggestInput {
  /**
   * Total water volume the salts are mixed into, in liters. Typically the sum of mash + sparge water.
   */
  water_volume_l: number;
  /**
   * Source water ion concentrations in ppm (mg/L).
   */
  source: {
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
   * Target water ion concentrations in ppm (mg/L).
   */
  target: {
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
