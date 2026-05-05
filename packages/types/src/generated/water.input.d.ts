/* eslint-disable */
/**
 * Auto-generated from schemas/tools/water.input.schema.json.
 * DO NOT EDIT — run `pnpm gen:types` to regenerate.
 */

export interface WaterInput {
  /**
   * Target finished volume into the fermenter (cooled), in liters.
   */
  batch_size_l: number;
  /**
   * Total dry weight of fermentables that participate in the mash (kg).
   */
  total_grain_kg: number;
  /**
   * Total boil duration, minutes.
   */
  boil_time_min: number;
  /**
   * Liters of strike water per kg of grain. Typical: 2.5-3.5 L/kg.
   */
  mash_thickness_l_per_kg: number;
  /**
   * Liters of water absorbed per kg of grain. Typical: 0.8-1.0 L/kg.
   */
  grain_absorption_l_per_kg?: number;
  /**
   * Volume left behind in the mash tun after lautering (liters).
   */
  mash_dead_space_l?: number;
  /**
   * Volume left behind in the boil kettle after transfer (liters).
   */
  kettle_dead_space_l?: number;
  /**
   * Boil-off rate in L/hour.
   */
  evaporation_rate_l_per_hour?: number;
  /**
   * Volume reduction percent from boiling temperature to room temperature.
   */
  post_boil_shrinkage_pct?: number;
  /**
   * Volume lost transferring from the boil kettle to the fermenter (liters).
   */
  kettle_to_fermenter_loss_l?: number;
}
