/**
 * Brewing-salt suggestion — the inverse of computeWaterAdditions.
 *
 * Forward (water-additions): grams of each salt → resulting ion profile.
 * Inverse (here): source + target ion profiles → grams of each salt that
 * move the source as close to the target as the salts allow.
 *
 * Model. Each salt's per-gram contribution to an ion is the same one the
 * forward calc uses (shared FRAC table):
 *
 *   ppm_per_gram(ion, salt) = 1000 × FRAC[salt][ion] / volume_l
 *
 * Stacking those across the six ions (Ca, Mg, Na, Cl, SO4, HCO3) and five
 * salts gives a 6×5 matrix A. With x = grams per salt and b = target − source
 * (the ppm delta we want to add), we solve the non-negative least squares
 *
 *   minimize ‖A·x − b‖²   subject to   x ≥ 0
 *
 * via projected coordinate descent (convex problem, 5 unknowns — converges
 * in a few hundred sweeps). Non-negativity matters: you can't remove ions by
 * adding salt, so the solver can only ever raise a deficient ion, never undo
 * an overshoot. The residual it reports makes that honest.
 *
 * Chalk is excluded from the suggestion set: it's barely soluble at mash pH
 * (see the forward calc's note), so recommending it would mislead. Brewers
 * who want carbonate can still add it by hand in the forward flow.
 *
 * Unweighted least squares in raw ppm — large-magnitude ions (e.g. HCO3)
 * carry more weight than trace ones (Mg). Adequate for v1; a per-ion weighting
 * pass is a future refinement.
 *
 * Pure function — inputs validated upstream by water-suggest.input.schema.json.
 */

import type { WaterSuggestInput, WaterSuggestOutput } from "@werb/types";
import { FRAC } from "./water-additions.js";

type Ion = "ca" | "mg" | "na" | "cl" | "so4" | "hco3";
const IONS: Ion[] = ["ca", "mg", "na", "cl", "so4", "hco3"];

// Salts the solver is allowed to use (chalk deliberately omitted).
const SALTS = [
  "gypsum",
  "calcium_chloride",
  "epsom",
  "table_salt",
  "baking_soda",
] as const;
type Salt = (typeof SALTS)[number];

export function suggestWaterAdditions(
  input: WaterSuggestInput,
): WaterSuggestOutput {
  const v = input.water_volume_l;
  const nIons = IONS.length;
  const nSalts = SALTS.length;

  // Flat matrix A[i*nSalts + j] = ppm added to ion i per gram of salt j.
  // Typed arrays so index access is `number`, not `number | undefined`.
  const A = new Float64Array(nIons * nSalts);
  IONS.forEach((ion, i) => {
    SALTS.forEach((salt, j) => {
      const frac = (FRAC[salt] as Partial<Record<Ion, number>>)[ion];
      A[i * nSalts + j] = frac ? (frac * 1000) / v : 0;
    });
  });

  // b[i] = ppm we still need to add to hit target (clamped at 0 — salts
  // can't lower an ion, so a source already above target asks for nothing).
  const b = new Float64Array(nIons);
  IONS.forEach((ion, i) => {
    const delta =
      (input.target[`${ion}_ppm`] ?? 0) - (input.source[`${ion}_ppm`] ?? 0);
    b[i] = delta > 0 ? delta : 0;
  });

  // `at(i)` reads — noUncheckedIndexedAccess unions index access with
  // undefined even on typed arrays, so coalesce to 0 (every slot is set).
  const a = (i: number, j: number) => A[i * nSalts + j] ?? 0;

  // Non-negative least squares by projected coordinate descent.
  // Precompute each column's squared norm A_j·A_j.
  const colNormSq = new Float64Array(nSalts);
  for (let j = 0; j < nSalts; j++) {
    let s = 0;
    for (let i = 0; i < nIons; i++) s += a(i, j) ** 2;
    colNormSq[j] = s;
  }
  const x = new Float64Array(nSalts);
  // Residual r = A·x − b, kept in sync as we nudge each x_j (starts at −b).
  const r = new Float64Array(nIons);
  for (let i = 0; i < nIons; i++) r[i] = -(b[i] ?? 0);

  for (let sweep = 0; sweep < 300; sweep++) {
    let maxStep = 0;
    for (let j = 0; j < nSalts; j++) {
      const cj = colNormSq[j] ?? 0;
      if (cj === 0) continue;
      // Optimal x_j given the others: x_j -= (A_j·r) / (A_j·A_j), clamped ≥ 0.
      let grad = 0;
      for (let i = 0; i < nIons; i++) grad += a(i, j) * (r[i] ?? 0);
      const xj = x[j] ?? 0;
      const next = Math.max(0, xj - grad / cj);
      const step = next - xj;
      if (step !== 0) {
        for (let i = 0; i < nIons; i++) r[i] = (r[i] ?? 0) + a(i, j) * step;
        x[j] = next;
      }
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    if (maxStep < 1e-6) break;
  }

  const grams = (salt: Salt) => {
    const g = x[SALTS.indexOf(salt)] ?? 0;
    // Snap sub-100mg noise to zero so the UI doesn't show "0.03 g".
    return g < 0.05 ? 0 : Math.round(g * 100) / 100;
  };

  const additions = {
    gypsum_g: grams("gypsum"),
    calcium_chloride_g: grams("calcium_chloride"),
    epsom_g: grams("epsom"),
    table_salt_g: grams("table_salt"),
    baking_soda_g: grams("baking_soda"),
  };

  // Achieved profile = source + Σ contributions. Computed from the same FRAC
  // model so it matches computeWaterAdditions exactly when fed `additions`.
  const add = (g: number, frac: number) => (g * frac * 1000) / v;
  const achieved = {
    ca_ppm:
      input.source.ca_ppm +
      add(additions.gypsum_g, FRAC.gypsum.ca) +
      add(additions.calcium_chloride_g, FRAC.calcium_chloride.ca),
    mg_ppm: input.source.mg_ppm + add(additions.epsom_g, FRAC.epsom.mg),
    na_ppm:
      input.source.na_ppm +
      add(additions.table_salt_g, FRAC.table_salt.na) +
      add(additions.baking_soda_g, FRAC.baking_soda.na),
    cl_ppm:
      input.source.cl_ppm +
      add(additions.calcium_chloride_g, FRAC.calcium_chloride.cl) +
      add(additions.table_salt_g, FRAC.table_salt.cl),
    so4_ppm:
      input.source.so4_ppm +
      add(additions.gypsum_g, FRAC.gypsum.so4) +
      add(additions.epsom_g, FRAC.epsom.so4),
    hco3_ppm:
      input.source.hco3_ppm + add(additions.baking_soda_g, FRAC.baking_soda.hco3),
  };

  const residual = {
    ca_ppm: achieved.ca_ppm - input.target.ca_ppm,
    mg_ppm: achieved.mg_ppm - input.target.mg_ppm,
    na_ppm: achieved.na_ppm - input.target.na_ppm,
    cl_ppm: achieved.cl_ppm - input.target.cl_ppm,
    so4_ppm: achieved.so4_ppm - input.target.so4_ppm,
    hco3_ppm: achieved.hco3_ppm - input.target.hco3_ppm,
  };

  return { additions, achieved, residual };
}
