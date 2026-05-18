/**
 * Water volumes calculation.
 *
 * Working backwards from the target fermenter volume, this resolves the
 * upstream water requirements at each stage of a single-infusion mash + sparge
 * + boil + chill + transfer process.
 *
 *   fermenter_target  ──┐
 *                       ├─ + kettle_to_fermenter_loss + kettle_dead_space  →  post_cool_kettle
 *   post_cool_kettle   ─┴─ ÷ (1 - shrinkage)                                →  post_boil (hot)
 *   post_boil (hot)        + boil_off                                       →  pre_boil (hot)
 *   pre_boil (hot)         + grain_absorption + mash_dead_space - mash_water →  sparge_water
 *
 * BIAB mode collapses mash + sparge into a single full-volume kettle
 * mash: `mash_water = pre_boil + grain_absorption + mash_dead_space`
 * and `sparge_water = 0`. The downstream boil-off / shrinkage / loss
 * math is identical — only the upstream split changes.
 *
 * Pure function — inputs validated upstream by water.input.schema.json.
 */

import type { WaterInput, WaterOutput } from "@werb/types";

export function computeWater(input: WaterInput): WaterOutput {
  const {
    batch_size_l,
    total_grain_kg,
    boil_time_min,
    mash_thickness_l_per_kg,
    grain_absorption_l_per_kg = 0.96,
    mash_dead_space_l = 0,
    kettle_dead_space_l = 0,
    evaporation_rate_l_per_hour = 3,
    post_boil_shrinkage_pct = 4,
    kettle_to_fermenter_loss_l = 0.5,
    biab = false,
  } = input;

  const grain_absorption_l = total_grain_kg * grain_absorption_l_per_kg;
  const boil_off_l = evaporation_rate_l_per_hour * (boil_time_min / 60);

  const post_cool_kettle_volume_l =
    batch_size_l + kettle_to_fermenter_loss_l + kettle_dead_space_l;
  const post_boil_volume_l =
    post_cool_kettle_volume_l / (1 - post_boil_shrinkage_pct / 100);
  const pre_boil_volume_l = post_boil_volume_l + boil_off_l;

  let mash_water_l: number;
  let sparge_water_l: number;
  if (biab) {
    // All water in the kettle at once. The mash needs to supply the
    // entire pre-boil volume plus what the grain absorbs (and any
    // dead space left behind). Mash thickness is ignored — BIAB
    // mashes are necessarily thin because the bag floats in all
    // the water at once.
    mash_water_l = pre_boil_volume_l + grain_absorption_l + mash_dead_space_l;
    sparge_water_l = 0;
  } else {
    mash_water_l = total_grain_kg * mash_thickness_l_per_kg;
    sparge_water_l =
      pre_boil_volume_l - mash_water_l + grain_absorption_l + mash_dead_space_l;
  }
  const total_water_l = mash_water_l + Math.max(sparge_water_l, 0);

  return {
    mash_water_l,
    sparge_water_l,
    total_water_l,
    pre_boil_volume_l,
    post_boil_volume_l,
    post_cool_kettle_volume_l,
    grain_absorption_l,
    boil_off_l,
  };
}
