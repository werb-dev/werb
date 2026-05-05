/**
 * IBU calculation — Tinseth method (metric).
 *
 * Reference: Glenn Tinseth, "Hop Bitterness, IBU and the Chemistry of Beer"
 * https://realbeer.com/hops/research.html
 *
 * Formula (metric, single addition):
 *   bigness_factor   = 1.65 * 0.000125 ^ (og - 1)
 *   time_factor      = (1 - exp(-0.04 * time_min)) / 4.15
 *   utilization      = bigness_factor * time_factor
 *   mg_per_L         = (alpha_decimal * mass_g * 1000) / batch_size_l
 *   ibu_contribution = utilization * mg_per_L
 *
 * Pure function — no I/O, no globals. Inputs are validated by the JSON Schema
 * at schemas/tools/ibu.input.schema.json (run validation upstream of this call).
 *
 * NOTE: Tinseth's original formula does not include a pellet/leaf utilization
 * multiplier. Many commercial tools apply ~1.10x for pellets. We deliberately
 * do not apply it here — it is a calibration knob for a future option.
 */

import type { IbuInput, IbuOutput } from "@werb/types";

export function computeIbu(input: IbuInput): IbuOutput {
  const method = input.method ?? "Tinseth";

  if (method !== "Tinseth") {
    throw new Error(
      `IBU method '${method}' is not implemented yet. Only 'Tinseth' is supported in v0.`,
    );
  }

  const { og, batch_size_l, hops } = input;
  const bigness = 1.65 * Math.pow(0.000125, og - 1);

  const additions = hops.map((h) => {
    const timeFactor = (1 - Math.exp(-0.04 * h.time_min)) / 4.15;
    const utilization = bigness * timeFactor;
    const alphaDecimal = h.alpha_acid_pct / 100;
    const mgPerL = (alphaDecimal * h.amount_g * 1000) / batch_size_l;
    const ibu = utilization * mgPerL;
    return {
      ...(h.name !== undefined ? { name: h.name } : {}),
      ibu,
      utilization,
    };
  });

  const total_ibu = additions.reduce((sum, a) => sum + a.ibu, 0);

  return { method, total_ibu, additions };
}
