/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Normalized input for computing yeast pitch rate and pack count for a brew.
 */
export interface YeastPitchInput {
  /**
   * Original gravity, specific gravity. Used to derive degrees Plato for the pitch-rate formula.
   */
  og_sg: number;
  /**
   * Volume of wort being pitched, in liters.
   */
  beer_volume_l: number;
  /**
   * Drives the target pitch rate in M cells/mL/°P. ale: 0.75. lager: 1.5. high_gravity (OG > 1.075): 1.0 for ales, 2.0 for lagers (rule of thumb).
   */
  style_type: "ale" | "lager" | "high_gravity";
  /**
   * Dry yeast is packaged dehydrated (Fermentis, LalBrew, Mangrove Jack's) — ~10 B viable cells/g, near 100% viability fresh. Liquid yeast comes in slurries or smack-packs (Wyeast, White Labs) — typically 100 B cells/pack at production, declining roughly 21% per month.
   */
  yeast_form: "dry" | "liquid";
  /**
   * Number of packs / sachets the brewer has on hand. Used to flag whether a starter is needed.
   */
  yeast_pack_count?: number;
  /**
   * Override the default cells-per-pack figure. Default: dry → 11.5 g × 10 B/g = 115 B; liquid → 100 B.
   */
  cells_per_pack_billion?: number;
  /**
   * Percentage of cells still viable at pitch time. Default: dry → 97% (fresh), liquid → 80% (1-2 month old smack-pack).
   */
  viability_pct?: number;
}
