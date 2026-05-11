/**
 * Brewing-salt addition calculator.
 *
 * Given a source water profile (Ca, Mg, Na, Cl, SO4, HCO3 in ppm),
 * the total water volume, and how many grams of each brewing salt
 * the brewer is adding, this returns the resulting ion levels plus
 * the SO4:Cl ratio and a coarse flavor hint.
 *
 * Math:
 *
 *   ppm_added = 1000 × mass_fraction × grams_of_salt / liters_of_water
 *
 * where mass_fraction is the share of the salt's molecular weight
 * taken up by the relevant ion. Hydrated forms are used since that's
 * what homebrewers actually buy — gypsum is sold as the dihydrate,
 * Epsom salt as the heptahydrate, etc. Values match Brun water and
 * the Palmer / Kaminski reference tables.
 *
 * Coarse flavor mapping (SO4:Cl ratio):
 *   < 0.5  → very_malty   (stouts, milds)
 *   0.5-1  → malty
 *   1-1.5  → balanced
 *   1.5-3  → hoppy        (pale ale)
 *   ≥ 3    → very_hoppy   (IPA, Burton)
 *
 * No mash-pH model in v1: pH depends on the grain bill too, which is
 * its own tool (Bru'n Water territory).
 *
 * Pure function — inputs validated upstream by
 * water-additions.input.schema.json.
 */

import type { WaterAdditionsInput, WaterAdditionsOutput } from "@werb/types";

// Mass fraction of each ion in a gram of each (hydrated) salt.
// Derived from MW(ion) / MW(salt). Source: Palmer, "How to Brew" +
// Bru'n Water reference table.
const FRAC = {
  gypsum: { ca: 0.2328, so4: 0.5580 }, // CaSO4·2H2O, MW 172.17
  calcium_chloride: { ca: 0.2726, cl: 0.4823 }, // CaCl2·2H2O, MW 147.01
  epsom: { mg: 0.0986, so4: 0.3898 }, // MgSO4·7H2O, MW 246.47
  table_salt: { na: 0.3934, cl: 0.6066 }, // NaCl, MW 58.44
  baking_soda: { na: 0.2737, hco3: 0.7264 }, // NaHCO3, MW 84.01
  chalk: { ca: 0.4004, hco3: 0.6096 }, // CaCO3, MW 100.09 — see note below
} as const;

// CaCO3 is barely soluble in water at brewing pH. The number above
// is the "perfect-world" contribution; in practice 30-50% is more
// realistic. We model the full number — brewers using chalk should
// know to discount, and adding a fudge factor inside the calc would
// surprise users who cross-check against other tools.

function flavorHint(
  ratio: number,
  cl: number,
): WaterAdditionsOutput["flavor_hint"] {
  if (cl <= 0) return "none";
  if (ratio < 0.5) return "very_malty";
  if (ratio < 1) return "malty";
  if (ratio < 1.5) return "balanced";
  if (ratio < 3) return "hoppy";
  return "very_hoppy";
}

export function computeWaterAdditions(
  input: WaterAdditionsInput,
): WaterAdditionsOutput {
  const v = input.water_volume_l;
  let ca = input.source.ca_ppm;
  let mg = input.source.mg_ppm;
  let na = input.source.na_ppm;
  let cl = input.source.cl_ppm;
  let so4 = input.source.so4_ppm;
  let hco3 = input.source.hco3_ppm;

  // Helper: convert "grams of salt × ion mass fraction" into ppm
  // increase, scaled by the water volume.
  const add = (grams: number | undefined, fraction: number): number =>
    grams ? (grams * fraction * 1000) / v : 0;

  const a = input.additions;
  if (a.gypsum_g) {
    ca += add(a.gypsum_g, FRAC.gypsum.ca);
    so4 += add(a.gypsum_g, FRAC.gypsum.so4);
  }
  if (a.calcium_chloride_g) {
    ca += add(a.calcium_chloride_g, FRAC.calcium_chloride.ca);
    cl += add(a.calcium_chloride_g, FRAC.calcium_chloride.cl);
  }
  if (a.epsom_g) {
    mg += add(a.epsom_g, FRAC.epsom.mg);
    so4 += add(a.epsom_g, FRAC.epsom.so4);
  }
  if (a.table_salt_g) {
    na += add(a.table_salt_g, FRAC.table_salt.na);
    cl += add(a.table_salt_g, FRAC.table_salt.cl);
  }
  if (a.baking_soda_g) {
    na += add(a.baking_soda_g, FRAC.baking_soda.na);
    hco3 += add(a.baking_soda_g, FRAC.baking_soda.hco3);
  }
  if (a.chalk_g) {
    ca += add(a.chalk_g, FRAC.chalk.ca);
    hco3 += add(a.chalk_g, FRAC.chalk.hco3);
  }

  const so4_cl_ratio = cl > 0 ? so4 / cl : 0;

  return {
    ca_ppm: ca,
    mg_ppm: mg,
    na_ppm: na,
    cl_ppm: cl,
    so4_ppm: so4,
    hco3_ppm: hco3,
    so4_cl_ratio,
    flavor_hint: flavorHint(so4_cl_ratio, cl),
  };
}
