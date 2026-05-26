/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Normalized input for IBU calculation tools. Decoupled from BeerJSON storage format: an adapter converts a BeerJSON Recipe + Equipment into this shape.
 */
export interface IbuInput {
  /**
   * Bitterness estimation method. Enum aligned with BeerJSON IBUMethodType.
   */
  method?: "Tinseth" | "Rager" | "Garetz" | "Other";
  /**
   * Post-boil wort volume in liters (cooled, into fermenter).
   */
  batch_size_l: number;
  /**
   * Original gravity (specific gravity, e.g. 1.050). Used as the wort gravity proxy in utilization formulas.
   */
  og: number;
  /**
   * @minItems 1
   */
  hops: [HopAddition, ...HopAddition[]];
}
export interface HopAddition {
  /**
   * Optional, for traceability and per-addition reporting.
   */
  name?: string;
  /**
   * Hop mass in grams.
   */
  amount_g: number;
  /**
   * Alpha acid content as a percentage (e.g. 5.5 means 5.5%).
   */
  alpha_acid_pct: number;
  /**
   * Contact time at the addition's temperature, in minutes. For boil hops this is the standard boil time; for whirlpool / hopstand additions it's the hold time at `temperature_c` before chilling.
   */
  time_min: number;
  /**
   * Hop form. Used by some methods to apply a utilization multiplier (e.g. pellet ~1.10x leaf).
   */
  form?: "pellet" | "leaf" | "leaf (wet)" | "plug" | "extract" | "powder";
  /**
   * Optional contact temperature in °C. Omit (or set ≥ 100) for boiling-temp additions. Whirlpool / hopstand additions held below 100 °C get their utilization derated by the calc — at ~77 °C the contribution effectively drops to zero.
   */
  temperature_c?: number;
}
