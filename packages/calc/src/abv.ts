/**
 * ABV (alcohol by volume) — simple homebrew formula.
 *
 *   ABV % ≈ (OG − FG) × 131.25
 *
 * Reasonable for OG up to ~1.080. Beyond that, Daniels' formula is more
 * accurate but rarely needed for typical homebrew gravity ranges.
 *
 * Pure utility — no separate JSON Schema contract because the inputs are
 * just two numbers. If we ever support multiple methods (Daniels, Berry),
 * promote it to a contract-first tool then.
 */
export function computeAbv(og: number, fg: number): number {
  return (og - fg) * 131.25;
}
