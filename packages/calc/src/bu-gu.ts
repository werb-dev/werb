/**
 * BU:GU ratio — bitterness (IBU) relative to gravity (gravity units).
 *
 *   BU:GU = IBU / ((OG − 1) × 1000)
 *
 * The headline balance metric brewers reason about: ~0.5 is balanced,
 * < 0.4 leans malty, > 0.8 leans aggressively hoppy. Independent of batch
 * size, so it travels across recipes better than raw IBU.
 *
 * Pure utility — no JSON Schema contract, same scope as computeAbv: the
 * inputs are two numbers already produced by computeIbu / computeGravity.
 */
export function computeBuGu(totalIbu: number, og: number): number {
  const gu = (og - 1) * 1000;
  return gu > 0 ? totalIbu / gu : 0;
}
