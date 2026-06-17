/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Profile of a brewing setup (HLT, mash tun, kettle, fermenter) used to compute volumes, losses, and efficiency for a brew session.
 */
export interface WerbEquipmentProfile {
  /**
   * Human-readable name of the equipment profile (e.g. 'Brewzilla 35L', 'Cooler MLT + propane kettle').
   */
  name: string;
  description?: string;
  /**
   * Target finished batch volume into the fermenter, in liters.
   */
  batch_size_l: number;
  /**
   * Total brewhouse efficiency, percent (mash + lauter + boil losses considered).
   */
  efficiency_pct: number;
  /**
   * Hot liquor tank — vessel where strike and sparge water are heated.
   */
  hlt?: {
    capacity_l: number;
    dead_space_l?: number;
  };
  mash_tun?: {
    capacity_l: number;
    dead_space_l?: number;
    /**
     * Liters of water absorbed per kg of grain. Typical: 0.8-1.0 L/kg.
     */
    grain_absorption_l_per_kg?: number;
    /**
     * Strike-water-to-grain ratio for the mash, in L/kg. The recipe's first mash-step infusion still wins when present; this is the brewer's default for recipes that don't carry their own mash schedule. Typical range: 2.5–4 L/kg.
     */
    mash_thickness_l_per_kg?: number;
  };
  kettle?: {
    capacity_l: number;
    dead_space_l?: number;
    /**
     * Boil-off rate in L/hour. Typical: 2-4 L/h depending on kettle and burner.
     */
    evaporation_rate_l_per_hour?: number;
    /**
     * Volume reduction percentage from boiling temperature to room temperature.
     */
    post_boil_shrinkage_pct?: number;
    /**
     * Post-boil hot→cold contraction as an absolute volume (L) instead of a percentage. When set, it overrides post_boil_shrinkage_pct — for brewers who'd rather enter a measured number of liters than a percentage.
     */
    post_boil_shrinkage_l?: number;
  };
  fermenter?: {
    capacity_l: number;
    /**
     * Volume left behind as trub/yeast cake when transferring to packaging.
     */
    trub_loss_l?: number;
  };
  /**
   * Volume lost during transfers between vessels (kettle to fermenter, fermenter to package).
   */
  transfer_loss_l?: number;
  /**
   * How this rig mashes. 'classic' = mash tun + separate sparge. 'biab' = brew in a bag, all water in the kettle, lift the bag, no sparge. 'single_vessel' = all-in-one (Brewzilla / Grainfather): mash and boil in one vessel but still sparge — water math is the classic mash+sparge split, just without a separate HLT or mash tun.
   */
  mash_mode?: "classic" | "biab" | "single_vessel";
  notes?: string;
}
