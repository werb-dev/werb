/**
 * Grain-bill percentages — each fermentable's share of the total bill by mass.
 *
 *   pct = mass_kg / Σ mass_kg × 100
 *
 * Lets the brewer reason in "70% Pilsner / 20% Munich / 10% wheat" terms
 * instead of raw grams. Computed by mass across the whole bill (the common
 * homebrew convention), so sugars and extracts count toward the total too.
 *
 * Pure utility — no JSON Schema contract; the input is just names + masses.
 * The result is aligned to the input order so callers can zip it back onto
 * their fermentable rows by index.
 */
export interface GrainBillShare {
  name: string;
  pct: number;
}

export function computeGrainBillPct(
  fermentables: { name: string; mass_kg: number }[],
): GrainBillShare[] {
  const total = fermentables.reduce((sum, f) => sum + (f.mass_kg || 0), 0);
  return fermentables.map((f) => ({
    name: f.name,
    pct: total > 0 ? ((f.mass_kg || 0) / total) * 100 : 0,
  }));
}
