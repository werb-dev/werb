/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Normalized input for planning the sparge: water temperature and, for batch sparging, how many runs the mash tun needs. Decoupled from BeerJSON: an adapter extracts these fields from a Recipe and an equipment profile.
 */
export interface SpargeInput {
  /**
   * 'fly' = continuous sparge: water trickles onto a grain bed already near the target, so it goes in at the target temperature. 'batch' = drain, add a run of water, stir, drain: each run mixes with the bed and has to bring it up to the target.
   */
  method: "batch" | "fly";
  /**
   * Total sparge water, in liters (from the water calc).
   */
  sparge_water_l: number;
  /**
   * Mashed grain, in kg.
   */
  grain_kg: number;
  /**
   * Water held by the grain after draining, in L/kg. It stays at mash temperature and has to be heated by the first run.
   */
  grain_absorption_l_per_kg?: number;
  /**
   * Wort left under the false bottom after draining, in liters.
   */
  mash_dead_space_l?: number;
  /**
   * Grain bed temperature at the end of the mash (last rest), in °C.
   */
  mash_temp_c: number;
  /**
   * Grain bed temperature to reach during the sparge, in °C. Typical: 75-77 °C. Above ~80 °C the bed releases tannins.
   */
  target_bed_temp_c?: number;
  /**
   * Mash tun volume, in liters. Batch sparge only: a run must fit alongside the drained grain, so a smaller tun splits the water into more runs. Omit for a single run.
   */
  mash_tun_capacity_l?: number;
  /**
   * Ratio of grain's specific heat to water's. Standard homebrew approximation: 0.41 (Palmer, 'How to Brew').
   */
  grain_specific_heat_ratio?: number;
}
