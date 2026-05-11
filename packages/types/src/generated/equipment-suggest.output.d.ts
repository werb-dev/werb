/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Recommended equipment profile values + the intermediate volumes the math is anchored on, so the UI can show the brewer how each number was reached.
 */
export interface EquipmentSuggestOutput {
  batch_size_l: number;
  efficiency_pct: number;
  hlt: {
    /**
     * Recommended HLT capacity in liters. 0 for two-vessel and BIAB setups — the kettle holds water in those cases, so the HLT fit-check should be disabled.
     */
    capacity_l: number;
    dead_space_l: number;
  };
  mash_tun: {
    /**
     * Recommended mash-tun capacity. 0 for BIAB — the kettle handles the mash.
     */
    capacity_l: number;
    dead_space_l: number;
    /**
     * Grain water absorption rate. Slightly higher for BIAB (no sparge to recover from grain).
     */
    grain_absorption_l_per_kg: number;
  };
  kettle: {
    capacity_l: number;
    dead_space_l: number;
    evaporation_rate_l_per_hour: number;
    post_boil_shrinkage_pct: number;
  };
  fermenter: {
    capacity_l: number;
    trub_loss_l: number;
  };
  transfer_loss_l: number;
  derived: {
    /**
     * Estimated grain bill at the target OG and efficiency. Drives mash-tun and BIAB-kettle sizing.
     */
    grain_kg: number;
    mash_water_l: number;
    /**
     * 0 for BIAB.
     */
    sparge_water_l: number;
    pre_boil_volume_l: number;
  };
}
