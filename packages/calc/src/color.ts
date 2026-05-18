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

  if (method !== "Morey" && method !== "Daniels") {
    throw new Error(
      `Color method '${method}' is not implemented. Supported: Morey, Daniels.`,
    );
  }

  // batch_size_l is schema-validated > 0, but the editor lets the user
  // type 0 — guard so MCU is 0 instead of Infinity.
  const batch_gal = input.batch_size_l > 0 ? input.batch_size_l * L_TO_GAL : 0;

  const mcu = batch_gal > 0
    ? input.fermentables.reduce((sum, f) => {
        const mass_lb = f.mass_kg * KG_TO_LB;
        // Morey / Daniels both expect Lovibond. SRM ≈ Lovibond at low
        // values; the discrepancy at high values is absorbed by Morey's
        // empirical exponent (and is bounded by Daniels' linear fit).
        return sum + (mass_lb * f.color_srm) / batch_gal;
      }, 0)
    : 0;

  // Daniels (1996, Designing Great Beers) — linear in MCU, tuned for
  // mid-to-darker beers (MCU ≥ ~6). Underestimates very pale beers;
  // brewers usually prefer Morey for ≤ 5 SRM and Daniels for the
  // amber-to-dark range where Morey's exponent overshoots.
  // For very low MCU (e.g. extract-only or distilled wort) Daniels
  // would predict a non-zero floor (~8.4 SRM); guard by falling
  // back to Morey under MCU < 1 so an empty/tiny bill returns ~0.
  let srm: number;
  if (method === "Daniels" && mcu >= 1) {
    srm = 0.2 * mcu + 8.4;
  } else {
    srm = 1.4922 * Math.pow(mcu, 0.6859);
  }
  const ebc = srm * 1.97;

  return { method, srm, ebc, mcu };
}
