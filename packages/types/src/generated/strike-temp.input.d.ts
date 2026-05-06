/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Normalized input for computing the strike water temperature needed to hit a target mash temperature when grain is added. Decoupled from BeerJSON: an adapter extracts these fields from a Recipe.
 */
export interface StrikeTempInput {
  /**
   * Desired mash rest temperature once grain has equilibrated, in °C.
   */
  mash_target_c: number;
  /**
   * Grain temperature at the moment of mash-in, in °C. Use ambient room temp if grain has been stored indoors.
   */
  grain_temp_c: number;
  /**
   * Mash thickness — liters of water per kg of grain. Typical: 1.5-3.5 L/kg.
   */
  thickness_l_per_kg: number;
  /**
   * Ratio of grain's specific heat to water's specific heat. Standard homebrew approximation: 0.41 (Palmer, 'How to Brew').
   */
  grain_specific_heat_ratio?: number;
}
