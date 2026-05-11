/**
 * Equipment sizing helper.
 *
 * Given a target fermenter volume and a brewery setup type, derive
 * recommended capacities for each vessel plus the standard losses and
 * rates. Output mirrors the WerbEquipmentProfile fields so the UI can
 * apply it directly.
 *
 * The math walks backward from batch volume to pre-boil volume, then
 * computes mash + sparge water from an estimated grain bill, then sizes
 * each vessel with a setup-specific headroom:
 *
 *   batch                                    (final in fermenter)
 *   + transfer loss                           → post-cool kettle volume
 *   ÷ (1 - shrink_pct/100)                    → end-of-boil kettle volume
 *   + boil_off                                → pre-boil volume
 *   + grain_absorption × grain_kg             → total water needed
 *
 * Grain mass comes from gravity points (OG - 1) × 1000 × batch_l,
 * divided by 308 (typical malt extract ppg-L/kg) × efficiency.
 *
 * Setup types differ in how vessels share roles:
 *
 *   three_vessel  : HLT (heats water) + mash tun + kettle (boils).
 *                   HLT capacity = max(mash, sparge) — strike and sparge
 *                   are heated separately and consecutively, so the
 *                   binding constraint is the larger of the two.
 *
 *   two_vessel    : Mash tun + kettle. The kettle doubles as HLT:
 *                   heat sparge water, drain to mash tun, then boil.
 *                   Kettle capacity = max(sparge, pre_boil). HLT = 0
 *                   so the fit-check is disabled.
 *
 *   biab          : Single kettle. Full-volume mash (no sparge), then
 *                   pull the bag and boil. Kettle must hold all the
 *                   water plus grain displacement during the mash.
 *                   HLT = MT = 0.
 *
 * Capacities are rounded UP — undersized equipment is the failure mode
 * we want to avoid. Brewers can tweak after the wizard applies.
 *
 * Pure function — inputs validated upstream by
 * equipment-suggest.input.schema.json.
 */

import type { EquipmentSuggestInput, EquipmentSuggestOutput } from "@werb/types";

// Defaults pulled from the homebrew consensus + the existing
// DEFAULT_PROFILE_VALUES so the wizard output feels familiar.
const TRANSFER_LOSS_L = 0.5;
const TRUB_LOSS_L = 0.5;
const POST_BOIL_SHRINK_PCT = 4;
const EVAPORATION_RATE_L_PER_HOUR = 3;

// Malt extract: ~37 PPG (points-per-gallon per pound) ≈ 308 SG-points·L per kg.
// At efficiency η, 1 kg malt contributes 308 × η points to the boil kettle
// over 1 L (i.e. points × L = 308 × η × kg). Solving for kg from a target
// (OG - 1) × 1000 × batch_l gives the grain bill.
const POINTS_PER_KG_AT_100_EFF = 308;

// Mash and grain volume constants.
const MASH_THICKNESS_L_PER_KG = 2.8; // Single-infusion homebrew default.
const GRAIN_DISPLACEMENT_L_PER_KG = 0.65; // Volume the grain occupies in the mash tun.
// BIAB has no sparge so we lose more wort to grain absorption. Bumping the
// rate slightly hedges the sizing — better than under-volume in the kettle.
const GRAIN_ABSORPTION_L_PER_KG_SPARGE = 0.8;
const GRAIN_ABSORPTION_L_PER_KG_BIAB = 0.95;

// Headroom percentages — gives the brewer room for boil-overs, krausen,
// and the inevitable "I'm doing 22 L this time" creep.
const HLT_HEADROOM_PCT = 10;
const MASH_TUN_HEADROOM_PCT = 15;
const KETTLE_HEADROOM_PCT = 15;
const FERMENTER_HEADROOM_PCT = 25;

const DEAD_SPACE_L_DEFAULT = 1;

function roundUp(x: number): number {
  return Math.ceil(x);
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function computeEquipmentSuggest(
  input: EquipmentSuggestInput,
): EquipmentSuggestOutput {
  const batch = input.batch_size_l;
  const og = input.target_og ?? 1.06;
  const effPct = input.efficiency_pct ?? 75;
  const eff = effPct / 100;
  const boilMin = input.boil_time_min ?? 60;

  // ─── Water budget (batch → pre-boil) ───────────────────────────────
  const postCool = batch + TRANSFER_LOSS_L;
  const endOfBoil = postCool / (1 - POST_BOIL_SHRINK_PCT / 100);
  const boilOff = EVAPORATION_RATE_L_PER_HOUR * (boilMin / 60);
  const preBoil = endOfBoil + boilOff;

  // ─── Grain bill estimate ───────────────────────────────────────────
  const points = (og - 1) * 1000 * batch;
  const grainKg = points / (POINTS_PER_KG_AT_100_EFF * eff);

  // ─── Mash + sparge ─────────────────────────────────────────────────
  const isBiab = input.setup_type === "biab";
  const grainAbs = isBiab
    ? GRAIN_ABSORPTION_L_PER_KG_BIAB
    : GRAIN_ABSORPTION_L_PER_KG_SPARGE;

  let mashWater: number;
  let spargeWater: number;
  if (isBiab) {
    // Full-volume mash: enough water to fill the kettle to pre-boil
    // after the grain has soaked up its share.
    mashWater = preBoil + grainAbs * grainKg;
    spargeWater = 0;
  } else {
    mashWater = MASH_THICKNESS_L_PER_KG * grainKg;
    const totalWater = preBoil + grainAbs * grainKg;
    spargeWater = totalWater - mashWater;
  }

  // ─── Vessel sizing ─────────────────────────────────────────────────
  const grainVolume = GRAIN_DISPLACEMENT_L_PER_KG * grainKg;

  const mashTunCapacity = isBiab
    ? 0
    : roundUp((mashWater + grainVolume) * (1 + MASH_TUN_HEADROOM_PCT / 100));

  let kettleCapacity: number;
  if (isBiab) {
    // Holds full mash volume + grain displacement.
    kettleCapacity = roundUp(
      (mashWater + grainVolume) * (1 + KETTLE_HEADROOM_PCT / 100),
    );
  } else if (input.setup_type === "two_vessel") {
    // Heats sparge AND boils. Max is the binding constraint.
    kettleCapacity = roundUp(
      Math.max(spargeWater, preBoil) * (1 + KETTLE_HEADROOM_PCT / 100),
    );
  } else {
    // Three-vessel: kettle only boils.
    kettleCapacity = roundUp(preBoil * (1 + KETTLE_HEADROOM_PCT / 100));
  }

  const hltCapacity =
    input.setup_type === "three_vessel"
      ? roundUp(Math.max(mashWater, spargeWater) * (1 + HLT_HEADROOM_PCT / 100))
      : 0;

  const fermenterCapacity = roundUp(batch * (1 + FERMENTER_HEADROOM_PCT / 100));

  return {
    batch_size_l: batch,
    efficiency_pct: effPct,
    hlt: {
      capacity_l: hltCapacity,
      dead_space_l: hltCapacity > 0 ? DEAD_SPACE_L_DEFAULT : 0,
    },
    mash_tun: {
      capacity_l: mashTunCapacity,
      dead_space_l: mashTunCapacity > 0 ? DEAD_SPACE_L_DEFAULT : 0,
      grain_absorption_l_per_kg: grainAbs,
    },
    kettle: {
      capacity_l: kettleCapacity,
      dead_space_l: DEAD_SPACE_L_DEFAULT,
      evaporation_rate_l_per_hour: EVAPORATION_RATE_L_PER_HOUR,
      post_boil_shrinkage_pct: POST_BOIL_SHRINK_PCT,
    },
    fermenter: {
      capacity_l: fermenterCapacity,
      trub_loss_l: TRUB_LOSS_L,
    },
    transfer_loss_l: TRANSFER_LOSS_L,
    derived: {
      grain_kg: round1(grainKg),
      mash_water_l: round1(mashWater),
      sparge_water_l: round1(spargeWater),
      pre_boil_volume_l: round1(preBoil),
    },
  };
}
