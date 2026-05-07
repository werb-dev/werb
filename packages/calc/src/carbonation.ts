/**
 * Carbonation calculations.
 *
 * Two outputs from the same set of inputs:
 *
 *   1. Priming sugar amounts. CO2 produced from fermenting a sugar:
 *      mass_co2 = mass_sugar × yield, where yield (g CO2 per g sugar) is:
 *        - dextrose monohydrate: 0.46
 *        - sucrose (table sugar): 0.51
 *        - dry malt extract:      0.34  (only ~70% fermentable)
 *      One volume of CO2 weighs ≈ 1.96 g per liter of beer at STP, so
 *        sugar_g = (target_vols − residual_vols) × 1.96 × beer_L / yield
 *
 *   2. Force-carbonation pressure (Henry's law, Zahm-Nagel chart fit). The
 *      regulator setting that holds `target_volumes_co2` at `serving_temp`.
 *
 * Residual CO2 in the beer at packaging follows the standard temperature
 * approximation (Daniels / "Designing Great Beers"):
 *
 *   residual_vols = 3.0378 − 0.050062 × T_F + 0.00026555 × T_F²
 *
 * where T_F is the highest fermentation temperature in °F. Beer that
 * fermented warmer holds less dissolved CO2.
 *
 * Pure function — inputs validated upstream by carbonation.input.schema.json.
 */

import type { CarbonationInput, CarbonationOutput } from "@werb/types";

const CO2_GRAMS_PER_LITER_PER_VOLUME = 1.96;

const SUGAR_YIELDS = {
  dextrose: 0.46,
  sucrose: 0.51,
  dme: 0.34,
} as const;

const PSI_PER_BAR = 14.5038;

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function residualVols(packageTempC: number): number {
  const t = cToF(packageTempC);
  return 3.0378 - 0.050062 * t + 0.00026555 * t * t;
}

function forcePressurePsi(volumes: number, servingTempC: number): number {
  const t = cToF(servingTempC);
  // Brewer's-Friend / McAuliffe polynomial fit to Zahm-Nagel CO2 chart.
  return (
    -16.6999 -
    0.0101059 * t +
    0.00116512 * t * t +
    0.173354 * t * volumes +
    4.24267 * volumes -
    0.0684226 * volumes * volumes
  );
}

export function computeCarbonation(input: CarbonationInput): CarbonationOutput {
  const {
    target_volumes_co2,
    beer_volume_l,
    package_temp_c,
    serving_temp_c = 4,
  } = input;

  const residual = residualVols(package_temp_c);
  const toAdd = target_volumes_co2 - residual;

  const co2NeededG = toAdd * CO2_GRAMS_PER_LITER_PER_VOLUME * beer_volume_l;
  const sugarG = (yieldRatio: number) =>
    co2NeededG > 0 ? co2NeededG / yieldRatio : 0;

  const psi = forcePressurePsi(target_volumes_co2, serving_temp_c);

  return {
    target_volumes_co2,
    residual_volumes_co2: residual,
    volumes_to_add: toAdd,
    priming: {
      dextrose_g: sugarG(SUGAR_YIELDS.dextrose),
      sucrose_g: sugarG(SUGAR_YIELDS.sucrose),
      dme_g: sugarG(SUGAR_YIELDS.dme),
    },
    force_pressure_psi: psi,
    force_pressure_bar: psi / PSI_PER_BAR,
  };
}
