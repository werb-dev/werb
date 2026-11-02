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
   * Minutes from flameout until the wort drops below 80 °C. Hops keep isomerising while the wort cools; the calc follows an exponential cooling curve from 100 °C towards 20 °C that crosses 80 °C at this time. 0 = instant chill, which matches the Tinseth / Rager calibration. Typical: wort chiller 0-5, no-chill pot 30-60, no-chill cube 90-150.
   */
  post_boil_minutes_to_80c?: number;
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
   * Hop form. Only 'leaf (wet)' changes the result: fresh, unkilned cones are ~80 % water, so their mass is scaled by 0.2 while `alpha_acid_pct` stays the variety's dry (kilned) value.
   */
  form?: "pellet" | "leaf" | "leaf (wet)" | "plug" | "extract" | "powder";
  /**
   * Optional contact temperature in °C. Omit (or set ≥ 100) for boiling-temp additions. Whirlpool / hopstand additions held below 100 °C use Malowicki isomerisation kinetics at this temperature, so cooler stands bitter less.
   */
  temperature_c?: number;
}
