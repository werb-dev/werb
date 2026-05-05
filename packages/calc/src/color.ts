/**
 * Color estimation — Morey's formula (the de facto homebrew default).
 *
 *   For each fermentable, MCU = (mass_lb × color_lovibond) / batch_gal
 *   total_mcu = Σ MCU
 *   SRM (Morey) = 1.4922 × total_mcu^0.6859
 *   EBC = SRM × 1.97
 *
 * Inputs come in metric SRM; we convert internally for the formula and
 * convert SRM ≈ Lovibond at homebrew gravities (within 1 unit up to SRM ~30).
 *
 * Pure function — inputs validated upstream by color.input.schema.json.
 */

import type { ColorInput, ColorOutput } from "@werb/types";

const KG_TO_LB = 2.2046226218;
const L_TO_GAL = 0.2641720524;

export function computeColor(input: ColorInput): ColorOutput {
  const method = input.method ?? "Morey";

  if (method !== "Morey") {
    throw new Error(
      `Color method '${method}' is not implemented yet. Only 'Morey' is supported in v0.`,
    );
  }

  const batch_gal = input.batch_size_l * L_TO_GAL;

  const mcu = input.fermentables.reduce((sum, f) => {
    const mass_lb = f.mass_kg * KG_TO_LB;
    // Morey formula expects Lovibond. SRM ≈ Lovibond at low values; the
    // discrepancy at high values is absorbed by Morey's empirical exponent.
    return sum + (mass_lb * f.color_srm) / batch_gal;
  }, 0);

  const srm = 1.4922 * Math.pow(mcu, 0.6859);
  const ebc = srm * 1.97;

  return { method, srm, ebc, mcu };
}
