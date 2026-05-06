/**
 * Strike water temperature calculation.
 *
 * Computes the temperature to heat strike water to so that, once cool grain
 * is doughed in, the mash equilibrates at the target rest temperature. The
 * formula (Palmer, "How to Brew") is:
 *
 *   T_strike = (c / r) × (T_mash − T_grain) + T_mash
 *
 * where:
 *   T_strike : strike water temperature (°C)
 *   T_mash   : target mash rest temperature (°C)
 *   T_grain  : initial grain temperature (°C)
 *   r        : mash thickness, liters of water per kg of grain
 *   c        : grain-to-water specific-heat ratio (≈0.41 for malted barley)
 *
 * It assumes thermal equilibrium and ignores heat loss to the mash tun walls
 * — for an uninsulated tun, brewers typically add 1-3 °C as a fudge factor.
 *
 * Pure function — inputs validated upstream by strike-temp.input.schema.json.
 */

import type { StrikeTempInput, StrikeTempOutput } from "@werb/types";

export function computeStrikeTemp(input: StrikeTempInput): StrikeTempOutput {
  const {
    mash_target_c,
    grain_temp_c,
    thickness_l_per_kg,
    grain_specific_heat_ratio = 0.41,
  } = input;

  const strike_temp_c =
    (grain_specific_heat_ratio / thickness_l_per_kg) * (mash_target_c - grain_temp_c) +
    mash_target_c;

  return {
    strike_temp_c,
    mash_target_c,
    grain_temp_c,
    thickness_l_per_kg,
  };
}
