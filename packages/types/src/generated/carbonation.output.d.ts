/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Carbonation calculation results: residual CO2, sugar amounts for the three common priming sugars, and equivalent force-carbonation pressure.
 */
export interface CarbonationOutput {
  /**
   * Echoed target carbonation level.
   */
  target_volumes_co2: number;
  /**
   * CO2 already dissolved in the beer at package_temp_c, in volumes. Comes from fermentation byproducts; subtracted from the target to get the amount priming must add.
   */
  residual_volumes_co2: number;
  /**
   * Volumes of CO2 priming must produce (target − residual). Negative if the beer is already over-carbonated for the target — in that case priming is not advised.
   */
  volumes_to_add: number;
  priming: {
    /**
     * Grams of corn sugar (dextrose monohydrate) to prime with. Most common homebrew sugar; CO2 yield ≈ 0.46 g/g.
     */
    dextrose_g: number;
    /**
     * Grams of table sugar (sucrose) to prime with. CO2 yield ≈ 0.51 g/g — about 10% less mass than dextrose for the same carbonation.
     */
    sucrose_g: number;
    /**
     * Grams of dry malt extract to prime with. CO2 yield ≈ 0.34 g/g — about 35% more mass than dextrose since DME is only partly fermentable.
     */
    dme_g: number;
  };
  /**
   * CO2 regulator pressure in PSI to maintain target_volumes_co2 at serving_temp_c (Henry's law fit). For force carbonation in a keg.
   */
  force_pressure_psi: number;
  /**
   * Same pressure expressed in bar.
   */
  force_pressure_bar: number;
}
