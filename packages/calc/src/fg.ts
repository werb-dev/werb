/**
 * Predicted Final Gravity from OG + yeast apparent attenuation.
 *
 *   FG = OG − (OG − 1) × (atten / 100)
 *
 * "Apparent" attenuation is the figure printed on every yeast spec
 * sheet — it already accounts for the alcohol's lower density, so the
 * straight subtraction lands on the right SG for the typical homebrew
 * range. We don't model staged fermentation (Brett finish, sour
 * post-pitch, refermentation) — those drift FG further down by a
 * point or two and are recorded in the brew log, not predicted here.
 *
 * Pure utility — same scope as computeAbv; promote to a contract if a
 * second method (e.g. real attenuation from refractometer correction)
 * ever shows up.
 */
export function computeFg(og: number, apparentAttenuationPct: number): number {
  return og - (og - 1) * (apparentAttenuationPct / 100);
}
