/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Sparge plan: how the sparge water is split and how hot to heat it.
 */
export interface SpargeOutput {
  /**
   * Echoed sparge method.
   */
  method: "batch" | "fly";
  /**
   * Number of equal sparge runs. 1 for fly sparge, 0 when there is no sparge water.
   */
  runs: number;
  /**
   * Water per run, in liters.
   */
  run_volume_l: number;
  /**
   * Temperature to heat the (first run of) sparge water to, in °C. Capped at 95 °C.
   */
  water_temp_c: number;
  /**
   * Temperature for the runs after the first, in °C: the bed is already at the target, so they go in at the target temperature.
   */
  next_runs_water_temp_c: number;
}
