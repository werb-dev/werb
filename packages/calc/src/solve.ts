/**
 * Solve-to-target scaling factors.
 *
 * The inverse of the forward OG / IBU calcs: instead of "given this bill,
 * what's the gravity?", answer "what multiplier on the bill hits the gravity
 * I want?". Both metrics are linear in ingredient mass for a fixed recipe
 * shape, so a single proportional factor suffices — no numeric solver:
 *
 *   grain factor = points_target / points_current   (points = (OG−1)×1000)
 *   hop   factor = ibu_target / ibu_current
 *
 * Like computeScale, these return a multiplier; the caller applies it to the
 * fermentable / hop amounts and never mutates a recipe here.
 *
 * Coupling note: raising OG lowers hop utilization slightly, so a grain solve
 * nudges IBU down. Solve grain first, then hops against the new OG — the
 * editor's live banner recomputes both, so the brewer sees the final numbers.
 *
 * Pure utilities — same scope as computeAbv (two numbers in, one out).
 */

/** Multiplier on the fermentable bill to move from `currentOg` to `targetOg`. */
export function solveGrainToOg(currentOg: number, targetOg: number): number {
  const currentPoints = (currentOg - 1) * 1000;
  const targetPoints = (targetOg - 1) * 1000;
  if (currentPoints <= 0 || targetPoints <= 0) return 1;
  return targetPoints / currentPoints;
}

/** Multiplier on the hop amounts to move from `currentIbu` to `targetIbu`. */
export function solveHopsToIbu(currentIbu: number, targetIbu: number): number {
  if (currentIbu <= 0 || targetIbu < 0) return 1;
  return targetIbu / currentIbu;
}
