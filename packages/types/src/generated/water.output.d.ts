/* eslint-disable */
/**
 * Auto-generated from schemas/tools/water.output.schema.json.
 * DO NOT EDIT — run `pnpm gen:types` to regenerate.
 */

export interface WaterOutput {
  /**
   * Strike water volume (mash infusion).
   */
  mash_water_l: number;
  /**
   * Sparge water volume. Negative values indicate the mash thickness is too high to reach pre-boil volume from sparge alone — caller should warn the user.
   */
  sparge_water_l: number;
  /**
   * Mash water + sparge water (assuming sparge_water_l >= 0).
   */
  total_water_l: number;
  /**
   * Wort volume in the kettle at the start of the boil (hot).
   */
  pre_boil_volume_l: number;
  /**
   * Wort volume in the kettle at the end of the boil (hot, before cooling).
   */
  post_boil_volume_l: number;
  /**
   * Wort volume in the kettle after cooling, before transfer to fermenter.
   */
  post_cool_kettle_volume_l: number;
  /**
   * Liters absorbed by the grain bed (lost to the spent grains).
   */
  grain_absorption_l: number;
  /**
   * Liters evaporated during the boil.
   */
  boil_off_l: number;
}
