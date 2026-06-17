/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Normalized input for computing strike water, sparge water, pre-boil and post-boil volumes for a brew session. Decoupled from BeerJSON: an adapter extracts these fields from a Recipe + Equipment profile.
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
   * Post-boil hot→cold contraction as an absolute volume (L). When provided, it overrides post_boil_shrinkage_pct: post_boil = post_cool + this.
   */
  post_boil_shrinkage_l?: number;
  /**
   * Volume lost transferring from the boil kettle to the fermenter (liters).
   */
  kettle_to_fermenter_loss_l?: number;
  /**
   * Brew-in-a-bag mode: all water (mash + would-be-sparge) goes into one vessel; the grain bag is lifted out at the end of the mash. Sparge water is zero; mash water = pre_boil + grain_absorption + mash_dead_space.
   */
  biab?: boolean;
}
