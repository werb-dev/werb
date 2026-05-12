/**
 * Yeast pitch-rate calculator.
 *
 * Standard pitch math used in homebrewing:
 *
 *   target_cells = target_rate × wort_mL × °P
 *
 * where:
 *   target_rate : M cells / mL / °P (depends on style)
 *   wort_mL     : beer_volume_l × 1000
 *   °P          : from OG_sg via the standard polynomial
 *
 * Target rates come from the long-running homebrew consensus
 * (Mr. Malty, BeerSmith, etc.):
 *
 *   • Ale (OG ≤ 1.075)            : 0.75 M/mL/°P
 *   • Lager (OG ≤ 1.075)          : 1.5  M/mL/°P
 *   • High-gravity (OG > 1.075)   : 1.0  M/mL/°P (ales) / 2.0 (lagers)
 *
 * Cells per pack default to ~200 B for an 11.5 g dry sachet and 100 B
 * for a fresh liquid pack (Wyeast / White Labs production claim).
 *
 * Fermentis publishes a minimum *guarantee* of 6 B/g but their own
 * spec sheets and independent counts (Brulosophy, Brewer's Friend,
 * BeerSmith) consistently land at 15–20 B viable cells / g for a
 * fresh sachet — so ~200 B per 11.5 g pack. That matches Fermentis'
 * own 50–80 g/hL dosing recommendation (≈ 2–3 sachets for a 50 L
 * 1.050 ale), which the older 115 B figure under-reported by ~2×.
 *
 * Viability defaults match the consensus: dry yeast holds well, liquid
 * loses ~21 % per month from production date.
 *
 * Pure function — inputs validated upstream by yeast-pitch.input.schema.json.
 */

import type { YeastPitchInput, YeastPitchOutput } from "@werb/types";

const DRY_CELLS_PER_PACK_BILLION = 200; // 11.5 g × ~17 B/g viable, fresh
const LIQUID_CELLS_PER_PACK_BILLION = 100; // Wyeast / White Labs at production

const DRY_DEFAULT_VIABILITY_PCT = 97;
const LIQUID_DEFAULT_VIABILITY_PCT = 80;

function sgToPlato(sg: number): number {
  // Polynomial approximation accurate within ±0.01 °P for 1.000–1.150.
  return -1 * 616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

function targetRate(styleType: YeastPitchInput["style_type"], ogSg: number): number {
  if (styleType === "lager") return ogSg > 1.075 ? 2.0 : 1.5;
  if (styleType === "high_gravity") return 1.0;
  return 0.75; // ale, normal gravity
}

export function computeYeastPitch(input: YeastPitchInput): YeastPitchOutput {
  const {
    og_sg,
    beer_volume_l,
    style_type,
    yeast_form,
    yeast_pack_count = 1,
    cells_per_pack_billion,
    viability_pct,
  } = input;

  const og_plato = sgToPlato(og_sg);
  const target_rate_m_per_ml_per_plato = targetRate(style_type, og_sg);

  // Target cells: rate (M cells / mL / °P) × wort mL × °P → millions
  // of cells, then ÷ 1000 → billions. Inline both ops as one to keep
  // the constant grouping legible.
  const target_cells_million =
    target_rate_m_per_ml_per_plato * (beer_volume_l * 1000) * og_plato;
  const target_cells_billion = target_cells_million / 1000;

  const default_pack_size =
    yeast_form === "dry" ? DRY_CELLS_PER_PACK_BILLION : LIQUID_CELLS_PER_PACK_BILLION;
  const default_viability =
    yeast_form === "dry" ? DRY_DEFAULT_VIABILITY_PCT : LIQUID_DEFAULT_VIABILITY_PCT;

  const packSize = cells_per_pack_billion ?? default_pack_size;
  const viability = (viability_pct ?? default_viability) / 100;
  const cells_per_pack_effective_billion = packSize * viability;

  const packs_needed = cells_per_pack_effective_billion > 0
    ? target_cells_billion / cells_per_pack_effective_billion
    : Infinity;
  const recommended_pack_count = Math.ceil(packs_needed);

  const available_cells = yeast_pack_count * cells_per_pack_effective_billion;
  const has_sufficient = available_cells >= target_cells_billion;
  const shortfall_billion_cells = has_sufficient
    ? 0
    : target_cells_billion - available_cells;

  return {
    og_plato,
    target_rate_m_per_ml_per_plato,
    target_cells_billion,
    cells_per_pack_effective_billion,
    packs_needed,
    recommended_pack_count,
    has_sufficient,
    shortfall_billion_cells,
  };
}
