/**
 * Recipe scaling factors.
 *
 * Given a recipe sized at one batch volume and brewhouse efficiency, this
 * computes the multipliers needed to retarget it at a different batch
 * volume and efficiency while preserving the gravity envelope. The caller
 * applies those multipliers to ingredient amounts; the calc engine itself
 * never mutates a recipe object.
 *
 *   volume_factor      = to_batch / from_batch
 *   fermentable_factor = volume_factor × (from_efficiency / to_efficiency)
 *
 * Hops, yeast, miscs and water volumes scale linearly with `volume_factor`.
 * Fermentables additionally compensate for any efficiency change so the
 * estimated original gravity stays on target — a lower target efficiency
 * means more grain to hit the same OG.
 *
 * Hop bitterness scaling is approximate: linear amount scaling at constant
 * gravity preserves IBU, but a different boil volume changes utilization
 * slightly. v1 accepts this drift; the caller can spot it via the
 * computed-vs-target IBU display and tweak hops manually.
 *
 * Pure function — inputs validated upstream by scale.input.schema.json.
 */

import type { ScaleInput, ScaleOutput } from "@werb/types";

export function computeScale(input: ScaleInput): ScaleOutput {
  const {
    from_batch_size_l,
    to_batch_size_l,
    from_efficiency_pct,
    to_efficiency_pct,
  } = input;

  const volume_factor = to_batch_size_l / from_batch_size_l;
  const fermentable_factor =
    volume_factor * (from_efficiency_pct / to_efficiency_pct);

  return {
    volume_factor,
    fermentable_factor,
    to_batch_size_l,
    to_efficiency_pct,
  };
}
