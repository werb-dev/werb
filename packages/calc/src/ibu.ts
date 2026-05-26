/**
 * IBU calculation.
 *
 * Two engines, picked per-addition:
 *
 *   - **Tinseth / Rager** drive boil-temperature hops. Tinseth is the
 *     community standard (Glenn Tinseth, "Hop Bitterness, IBU and the
 *     Chemistry of Beer", https://realbeer.com/hops/research.html);
 *     Rager is a switchable alternative (Settings → IBU method). Boil-
 *     hop behaviour is unchanged from earlier Werb versions, so
 *     recipes calibrated against Tinseth in v0.3 keep matching here.
 *
 *   - **Malowicki kinetics** drive sub-boil hops (whirlpool / hopstand
 *     additions with `temperature_c` below 100 °C). Reference:
 *     Mark Malowicki, "Hop Bitter Acid Isomerization and Degradation
 *     Kinetics in a Model Wort-Boiling System" (Oregon State, 2005).
 *     The model tracks iso-α-acid formation as a two-step Arrhenius
 *     process:
 *         dα/dt   = −k1(T) · α          (alpha-acids isomerise)
 *         d[iso]/dt = k1(T) · α − k2(T) · [iso]   (iso-AA degrade)
 *     Closed-form at constant T:
 *         u(T, t) = k1 / (k1 − k2) · (exp(−k2·t) − exp(−k1·t))
 *     Multiplied by `MALOWICKI_TO_BEER` (≈ 0.255) to absorb trub /
 *     fermentation / age losses into a single calibration constant —
 *     anchored so a 60-min addition at 100 °C lands on Tinseth's
 *     finished-beer utilisation. Replaces the previous
 *     ((T−76.7)/23.3)² approximation, which was a Brewfather-style
 *     curve fit that under-counted real-world whirlpool IBUs.
 *
 * Pure function — no I/O, no globals. Inputs are validated by the JSON
 * Schema at schemas/tools/ibu.input.schema.json.
 *
 * Future work: full SMPH (oAAs + pH + clarity + krausen + age) is a
 * separate, larger upgrade. This module only implements the kinetic
 * core that sub-boil additions actually need.
 */

import type { IbuInput, IbuOutput } from "@werb/types";

/**
 * Malowicki Arrhenius parameters (k = A · exp(−Ea/R · 1/T_K), per min).
 * From Malowicki 2005, Table 4.2:
 *   k1 (alpha → iso):  A = 7.9 · 10^11 /min,  Ea/R = 11858 K
 *   k2 (iso → degraded): A = 4.1 · 10^12 /min,  Ea/R = 12994 K
 * At 373.15 K (boiling) these give k1 ≈ 0.122 /min and k2 ≈ 0.0030 /min,
 * which match the published rate constants to ~2 %.
 */
const MAL_K1_PRE = 7.9e11;
const MAL_K1_EA_OVER_R = 11858;
const MAL_K2_PRE = 4.1e12;
const MAL_K2_EA_OVER_R = 12994;

/**
 * Beer-side scaling: Malowicki gives wort iso-AA fraction; this
 * constant maps it to a finished-beer IBU yield. Calibrated so a
 * 100 °C × 60 min datum lands on Tinseth's utilisation at OG 1.050
 * (Malowicki u_wort = 0.475 → Tinseth u_beer = 0.218 → ratio ≈ 0.46).
 * Single-knob approximation of the trub + fermentation + age losses
 * that SMPH models in detail.
 */
const MALOWICKI_TO_BEER = 0.46;

function malowickiUtilization(tempC: number, timeMin: number): number {
  if (timeMin <= 0) return 0;
  const T = tempC + 273.15;
  const k1 = MAL_K1_PRE * Math.exp(-MAL_K1_EA_OVER_R / T);
  const k2 = MAL_K2_PRE * Math.exp(-MAL_K2_EA_OVER_R / T);
  if (k1 <= 0 || Math.abs(k1 - k2) < 1e-15) return 0;
  return (
    (k1 / (k1 - k2)) *
    (Math.exp(-k2 * timeMin) - Math.exp(-k1 * timeMin))
  );
}

export function computeIbu(input: IbuInput): IbuOutput {
  const method = input.method ?? "Tinseth";

  if (method !== "Tinseth" && method !== "Rager") {
    throw new Error(
      `IBU method '${method}' is not implemented. Supported: Tinseth, Rager.`,
    );
  }

  const { og, batch_size_l, hops } = input;
  // Rager uses a gravity adjustment as a flat post-divisor instead of
  // Tinseth's bigness factor. Compute both up-front; per-hop math
  // picks whichever the method needs.
  const bigness = 1.65 * Math.pow(0.000125, og - 1);
  const gravityAdjustment = og > 1.05 ? (og - 1.05) / 0.2 : 0;

  const additions = hops.map((h) => {
    const alphaDecimal = h.alpha_acid_pct / 100;
    // batch_size_l is schema-validated > 0, but the editor allows 0
    // entry — guard so IBU is 0 instead of Infinity propagating
    // through the Recipe tile and BJCP-range coloring.
    const mgPerL =
      batch_size_l > 0 ? (alphaDecimal * h.amount_g * 1000) / batch_size_l : 0;
    let utilization: number;
    let ibu: number;
    // Sub-boil additions take the Malowicki path regardless of the
    // top-level method preference. Tinseth and Rager were both fit
    // against boil-only data and produce nonsense for hopstands —
    // the kinetic model is what the SMPH literature uses for this
    // regime.
    const subBoil = h.temperature_c !== undefined && h.temperature_c < 100;
    if (subBoil) {
      utilization = malowickiUtilization(h.temperature_c!, h.time_min) *
        MALOWICKI_TO_BEER;
      ibu = utilization * mgPerL;
    } else if (method === "Rager") {
      // Rager 1990 — hyperbolic tangent in boil time, then divide
      // through (1 + GA) for high-gravity worts. Tends to read
      // higher than Tinseth at long boils.
      utilization = (18.11 + 13.86 * Math.tanh((h.time_min - 31.32) / 18.27)) / 100;
      ibu = (mgPerL * utilization) / (1 + gravityAdjustment);
    } else {
      // Tinseth (default).
      const timeFactor = (1 - Math.exp(-0.04 * h.time_min)) / 4.15;
      utilization = bigness * timeFactor;
      ibu = utilization * mgPerL;
    }
    return {
      ...(h.name !== undefined ? { name: h.name } : {}),
      ibu: Math.max(0, ibu),
      utilization: Math.max(0, utilization),
    };
  });

  const total_ibu = additions.reduce((sum, a) => sum + a.ibu, 0);

  return { method, total_ibu, additions };
}
