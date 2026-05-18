/**
 * Yeast starter sizing — recommend a starter volume that grows
 * `available_cells_billion` up to `target_cells_billion`, given the
 * brewer's aeration setup.
 *
 * Growth model: Braukaiser (Kai Troester) regression on stir-plate
 * data — final density saturates as the inoculation rate climbs.
 *
 *   growth_factor = clamp(1, 12.54793 × inoc_rate^(-0.4594), 6)
 *
 * where inoc_rate is in M cells / mL. Shake / no-aeration setups
 * scale the growth (above 1×) down by an experimental factor; the
 * homebrew consensus is roughly 2/3 for shaken, 1/2 for still.
 *
 * The function answers two questions:
 *   • What starter volume, given my pack, will get me to target?
 *   • Will a single step do it, or do I need to step up?
 *
 * Pure function — no I/O. Companion to computeYeastPitch which
 * sizes the *pitch*, not the starter.
 */

export type StarterAeration = "stir_plate" | "shake" | "none";

export interface YeastStarterInput {
  /** Cells the brewer has available before the starter, in billions. */
  available_cells_billion: number;
  /** Cells needed at pitch time, in billions. */
  target_cells_billion: number;
  /** Aeration / agitation method. Determines max growth per step. */
  aeration?: StarterAeration;
}

export interface YeastStarterOutput {
  /**
   * Recommended starter volume in litres. 0 when no starter is
   * needed (available already meets or exceeds target).
   */
  starter_volume_l: number;
  /**
   * Dry malt extract mass, in grams, to build the starter at the
   * canonical 1.036 OG (≈100 g DME per litre).
   */
  dme_g: number;
  /**
   * Predicted cells after the starter, in billions. Compares against
   * target so the brewer can see whether one step is enough.
   */
  predicted_cells_billion: number;
  /**
   * True when the recommended single-step volume hits the cap (4 L) and
   * still falls short — a 2-step starter is preferable to a 6 L jug.
   */
  needs_step_up: boolean;
  /** Growth factor of the recommended setup (final / initial). */
  growth_factor: number;
}

const MAX_VOLUME_L = 4; // homebrew sanity cap; 5 L flasks are common.
const MIN_VOLUME_L = 0.25; // anything smaller is just a slurry restart.
const DME_G_PER_L = 100; // 1.036 starter wort.

function stirGrowthFactor(inoc_rate_m_per_ml: number): number {
  if (inoc_rate_m_per_ml <= 0) return 6;
  return Math.min(6, Math.max(1, 12.54793 * Math.pow(inoc_rate_m_per_ml, -0.4594)));
}

function aerationScale(aeration: StarterAeration): number {
  if (aeration === "stir_plate") return 1;
  if (aeration === "shake") return 2 / 3;
  return 1 / 2;
}

function predictedCells(
  available_billion: number,
  volume_l: number,
  aeration: StarterAeration,
): { cells: number; growth_factor: number } {
  // available is in billions = thousands of millions; divide by
  // (volume_l × 1000) mL to get M cells / mL.
  const inoc_rate_m_per_ml = (available_billion * 1000) / (volume_l * 1000);
  const stirGrowth = stirGrowthFactor(inoc_rate_m_per_ml);
  // Lower aerations attenuate the growth *bonus*, not the baseline:
  // even a still starter can't shrink the cell count.
  const growth = 1 + (stirGrowth - 1) * aerationScale(aeration);
  return { cells: available_billion * growth, growth_factor: growth };
}

export function computeYeastStarter(input: YeastStarterInput): YeastStarterOutput {
  const aeration = input.aeration ?? "stir_plate";
  const { available_cells_billion, target_cells_billion } = input;

  if (available_cells_billion >= target_cells_billion || available_cells_billion <= 0) {
    return {
      starter_volume_l: 0,
      dme_g: 0,
      predicted_cells_billion: available_cells_billion,
      needs_step_up: false,
      growth_factor: 1,
    };
  }

  // Binary-search the smallest volume in [MIN, MAX] L that hits the
  // target — within a 30-step bisection that's accurate to ~10⁻⁸ L.
  let lo = MIN_VOLUME_L;
  let hi = MAX_VOLUME_L;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const predicted = predictedCells(available_cells_billion, mid, aeration).cells;
    if (predicted >= target_cells_billion) hi = mid;
    else lo = mid;
  }
  const volume_at_cap = predictedCells(available_cells_billion, MAX_VOLUME_L, aeration);
  const needs_step_up = volume_at_cap.cells < target_cells_billion;
  const chosen_volume_l = needs_step_up ? MAX_VOLUME_L : Math.round(hi * 100) / 100;
  const result = predictedCells(available_cells_billion, chosen_volume_l, aeration);
  return {
    starter_volume_l: chosen_volume_l,
    dme_g: Math.round(chosen_volume_l * DME_G_PER_L),
    predicted_cells_billion: result.cells,
    needs_step_up,
    growth_factor: result.growth_factor,
  };
}
