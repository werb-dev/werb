/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Strike water temperature plus the inputs that drove the calculation, echoed for display.
 */
export interface StrikeTempOutput {
  /**
   * Temperature to heat the strike water to before doughing in, in °C.
   */
  strike_temp_c: number;
  /**
   * Echoed mash rest target temperature.
   */
  mash_target_c: number;
  /**
   * Echoed grain temperature.
   */
  grain_temp_c: number;
  /**
   * Echoed mash thickness.
   */
  thickness_l_per_kg: number;
}
