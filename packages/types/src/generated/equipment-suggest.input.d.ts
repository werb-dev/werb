/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Given a target batch size and a brewery setup type, recommend vessel capacities, losses, and rates to seed an equipment profile.
 */
export interface EquipmentSuggestInput {
  /**
   * three_vessel: HLT + mash tun + kettle (HERMS-style). two_vessel: mash tun + kettle, kettle doubles as HLT for heating sparge water. biab: brew in a bag — single kettle holds full-volume mash and the boil, no HLT or mash tun.
   */
  setup_type: "three_vessel" | "two_vessel" | "biab";
  /**
   * Target fermenter volume after losses, in liters. Drives every other capacity.
   */
  batch_size_l: number;
  /**
   * Expected original gravity to size the mash tun against. Defaults to 1.060 — covers most pale ales / IPAs without short-changing high-gravity brews enough to matter.
   */
  target_og?: number;
  /**
   * Expected brewhouse efficiency, used to estimate grain mass from target OG.
   */
  efficiency_pct?: number;
  /**
   * Standard boil duration. Drives boil-off volume and therefore pre-boil / kettle sizing.
   */
  boil_time_min?: number;
}
