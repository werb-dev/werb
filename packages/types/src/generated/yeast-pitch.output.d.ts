/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Yeast pitch-rate results: target cells, packs required, and whether a starter is recommended.
 */
export interface YeastPitchOutput {
  /**
   * Original gravity in degrees Plato (computed from og_sg).
   */
  og_plato: number;
  /**
   * Industry-standard cell density target, in millions of cells per mL per °P. 0.75 / 1.0 / 1.5 / 2.0 depending on style_type.
   */
  target_rate_m_per_ml_per_plato: number;
  /**
   * Total viable cells needed for this brew, in billions. target_rate × beer_volume_mL × og_plato.
   */
  target_cells_billion: number;
  /**
   * Cells per pack after applying the viability percentage, in billions.
   */
  cells_per_pack_effective_billion: number;
  /**
   * Fractional packs needed to meet the target. e.g. 1.7 means a single pack falls short.
   */
  packs_needed: number;
  /**
   * ceil(packs_needed) — the smallest pack count that meets the target without a starter.
   */
  recommended_pack_count: number;
  /**
   * True when the brewer's yeast_pack_count is enough to meet the target.
   */
  has_sufficient: boolean;
  /**
   * How many more cells the brewer needs beyond what their on-hand packs supply. Zero if has_sufficient is true.
   */
  shortfall_billion_cells: number;
}
