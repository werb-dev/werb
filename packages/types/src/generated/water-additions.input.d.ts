/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Source water ion profile + brewing salt additions + total water volume. Drives the resulting-ion calc.
 */
export interface WaterAdditionsInput {
  /**
   * Total water volume the salts are mixed into, in liters. Typically the sum of mash + sparge water.
   */
  water_volume_l: number;
  source: IonProfile;
  /**
   * Brewing salt amounts in grams. All optional — omit a salt to leave it out.
   */
  additions: {
    /**
     * Calcium sulfate (CaSO4·2H2O).
     */
    gypsum_g?: number;
    /**
     * Calcium chloride (CaCl2·2H2O).
     */
    calcium_chloride_g?: number;
    /**
     * Magnesium sulfate (MgSO4·7H2O), 'Epsom salt'.
     */
    epsom_g?: number;
    /**
     * Sodium chloride (NaCl).
     */
    table_salt_g?: number;
    /**
     * Sodium bicarbonate (NaHCO3).
     */
    baking_soda_g?: number;
    /**
     * Calcium carbonate (CaCO3). Low solubility — not fully effective in mash.
     */
    chalk_g?: number;
  };
}
/**
 * Source water ion concentrations in ppm (mg/L).
 */
export interface IonProfile {
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
}
