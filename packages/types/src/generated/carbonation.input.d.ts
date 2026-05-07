/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Normalized input for computing priming sugar amounts and force-carbonation pressure for a finished beer.
 */
export interface CarbonationInput {
  /**
   * Target carbonation level in volumes of CO2. Typical: 1.8 (English ale) to 3.0 (German wheat / Belgian).
   */
  target_volumes_co2: number;
  /**
   * Volume of beer being packaged, in liters.
   */
  beer_volume_l: number;
  /**
   * Highest temperature the beer reached during fermentation, in °C. Determines the residual CO2 already dissolved in the beer (Henry's law).
   */
  package_temp_c: number;
  /**
   * Keg / serving temperature in °C. Used only for the force-carbonation pressure output. Default 4 °C (typical kegerator).
   */
  serving_temp_c?: number;
}
