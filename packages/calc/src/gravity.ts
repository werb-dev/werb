/**
 * Predicted Original Gravity from a fermentable bill.
 *
 * Method (metric):
 *   Each fermentable contributes (mass_kg × yield_decimal × 384) gravity
 *   units per liter at 100% efficiency.
 *     384 GU·L/kg = points-per-pound-per-gallon (46) × kg→lb × gal→L
 *   For mashed fermentables, multiply by brewhouse efficiency.
 *   For extracts/sugars, no efficiency loss.
 *   total_GU = Σ contributions / batch_size_l
 *   OG = 1 + total_GU / 1000
 *
 * Pure function — inputs validated upstream by gravity.input.schema.json.
 */

import type { GravityInput, GravityOutput } from "@werb/types";

const SUCROSE_GU_PER_KG_PER_L = 384;

export function computeGravity(input: GravityInput): GravityOutput {
  const efficiency = input.efficiency_pct / 100;

  const totalGu = input.fermentables.reduce((sum, f) => {
    const yieldDecimal = f.yield_pct / 100;
    const efficiencyMultiplier = f.category === "mashed" ? efficiency : 1;
    const contribution = f.mass_kg * yieldDecimal * SUCROSE_GU_PER_KG_PER_L * efficiencyMultiplier;
    return sum + contribution;
  }, 0);

  const gravity_units = totalGu / input.batch_size_l;
  const og = 1 + gravity_units / 1000;

  return { og, gravity_units };
}
