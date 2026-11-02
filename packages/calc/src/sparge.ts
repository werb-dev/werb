/**
 * Sparge plan: water temperature and number of runs.
 *
 * Fly sparge: water trickles onto a bed already near the target, so it goes
 * in at the target bed temperature, in one continuous run.
 *
 * Batch sparge: each run mixes with the drained bed (grain + the water it
 * holds + dead space), still at mash temperature for the first run. Heat
 * balance for the first run:
 *
 *   T_water = T_target + (c × G + A + D) × (T_target − T_mash) / V_run
 *
 * where G is grain (kg), A the absorbed water (L), D the dead space (L),
 * c the grain-to-water specific-heat ratio and V_run the run volume (L).
 * Later runs meet a bed already at the target, so they go in at T_target.
 *
 * A run must fit in the mash tun next to the drained bed:
 *
 *   V_run ≤ capacity − D − A − 0.67 L/kg × G
 *
 * (0.67 L/kg is the volume dry grain displaces). The water is split into
 * the fewest equal runs that fit.
 *
 * Pure function — inputs validated upstream by sparge.input.schema.json.
 */

import type { SpargeInput, SpargeOutput } from "@werb/types";

/** Volume displaced by dry grain, L/kg. */
const GRAIN_DISPLACEMENT_L_PER_KG = 0.67;
/** Hottest water the plan asks for; a run too small to heat the bed hits this. */
const MAX_WATER_TEMP_C = 95;

export function computeSparge(input: SpargeInput): SpargeOutput {
  const {
    method,
    sparge_water_l,
    grain_kg,
    grain_absorption_l_per_kg = 0.96,
    mash_dead_space_l = 0,
    mash_temp_c,
    target_bed_temp_c = 75,
    mash_tun_capacity_l,
    grain_specific_heat_ratio = 0.41,
  } = input;

  const flat = { method, next_runs_water_temp_c: target_bed_temp_c };
  if (sparge_water_l <= 0) {
    return { ...flat, runs: 0, run_volume_l: 0, water_temp_c: target_bed_temp_c };
  }
  if (method === "fly") {
    return { ...flat, runs: 1, run_volume_l: sparge_water_l, water_temp_c: target_bed_temp_c };
  }

  const absorbedL = grain_kg * grain_absorption_l_per_kg;
  const maxRunL =
    mash_tun_capacity_l !== undefined
      ? mash_tun_capacity_l - mash_dead_space_l - absorbedL - grain_kg * GRAIN_DISPLACEMENT_L_PER_KG
      : Infinity;
  // A tun too small for the drained bed is a mash-sizing problem, not a
  // sparge one: plan a single run rather than an absurd split.
  const runs = maxRunL > 0 ? Math.max(1, Math.ceil(sparge_water_l / maxRunL - 1e-9)) : 1;
  const runVolumeL = sparge_water_l / runs;

  const bedHeatCapacityL = grain_specific_heat_ratio * grain_kg + absorbedL + mash_dead_space_l;
  const waterTempC =
    target_bed_temp_c + (bedHeatCapacityL * (target_bed_temp_c - mash_temp_c)) / runVolumeL;

  return {
    ...flat,
    runs,
    run_volume_l: runVolumeL,
    water_temp_c: Math.min(waterTempC, MAX_WATER_TEMP_C),
  };
}
