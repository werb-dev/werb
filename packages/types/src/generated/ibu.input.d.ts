/* eslint-disable */
/**
 * Auto-generated from schemas/tools/ibu.input.schema.json.
 * DO NOT EDIT — run `pnpm gen:types` to regenerate.
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
   * Boil contact time in minutes. 0 for flameout/whirlpool/dry hop additions (which contribute 0 IBU under standard Tinseth).
   */
  time_min: number;
  /**
   * Hop form. Used by some methods to apply a utilization multiplier (e.g. pellet ~1.10x leaf).
   */
  form?: "pellet" | "leaf" | "leaf (wet)" | "plug" | "extract" | "powder";
}
