/**
 * Bundled source-water profiles. Brewers pick one to seed the
 * Recipe screen's water-chemistry form instead of typing six ions
 * from memory. Values are ppm and represent the canonical / often-
 * cited published analysis for each town — actual tap water will
 * drift; the brewer should still get their own analysis when it
 * matters. Sources: Palmer "Water" (2013), Bru'n Water, local
 * water-board reports.
 *
 * Added entries follow the same shape as the rest of the catalog:
 * one curated array, no in-app editing. PRs welcome (principle #7).
 */

export interface SourceWaterProfile {
  /** Display name — typically a city / region. Kept verbatim across locales. */
  name: string;
  /** Stable identifier for storage / lookups. */
  key: string;
  /** ppm of each major ion. */
  ca_ppm: number;
  mg_ppm: number;
  na_ppm: number;
  cl_ppm: number;
  so4_ppm: number;
  hco3_ppm: number;
  /** Short one-liner: typical style fit. */
  notes?: string;
}

export const SOURCE_WATER_PROFILES: SourceWaterProfile[] = [
  {
    name: "Distilled / RO",
    key: "ro",
    ca_ppm: 0, mg_ppm: 0, na_ppm: 0, cl_ppm: 0, so4_ppm: 0, hco3_ppm: 0,
    notes: "Blank slate — build the profile entirely from salts.",
  },
  {
    name: "Pilsen",
    key: "pilsen",
    ca_ppm: 7, mg_ppm: 3, na_ppm: 2, cl_ppm: 5, so4_ppm: 5, hco3_ppm: 15,
    notes: "Famously soft — Czech & German pilsner.",
  },
  {
    name: "Munich",
    key: "munich",
    ca_ppm: 75, mg_ppm: 18, na_ppm: 2, cl_ppm: 2, so4_ppm: 10, hco3_ppm: 152,
    notes: "Moderately hard, alkaline — Munich helles / dunkel.",
  },
  {
    name: "Dortmund",
    key: "dortmund",
    ca_ppm: 225, mg_ppm: 40, na_ppm: 60, cl_ppm: 60, so4_ppm: 120, hco3_ppm: 220,
    notes: "Hard, balanced sulfate/chloride — Dortmunder Export.",
  },
  {
    name: "Vienna",
    key: "vienna",
    ca_ppm: 75, mg_ppm: 15, na_ppm: 10, cl_ppm: 15, so4_ppm: 60, hco3_ppm: 120,
    notes: "Moderate — Vienna lager, märzen.",
  },
  {
    name: "Burton-on-Trent",
    key: "burton",
    ca_ppm: 295, mg_ppm: 45, na_ppm: 55, cl_ppm: 25, so4_ppm: 725, hco3_ppm: 300,
    notes: "Extreme sulfate — pale ale, IPA. Iconic for hop bite.",
  },
  {
    name: "London",
    key: "london",
    ca_ppm: 90, mg_ppm: 5, na_ppm: 15, cl_ppm: 40, so4_ppm: 40, hco3_ppm: 125,
    notes: "Moderate alkalinity — porter, mild, bitter.",
  },
  {
    name: "Edinburgh",
    key: "edinburgh",
    ca_ppm: 125, mg_ppm: 25, na_ppm: 55, cl_ppm: 65, so4_ppm: 140, hco3_ppm: 225,
    notes: "Hard, balanced — Scottish ales.",
  },
  {
    name: "Dublin",
    key: "dublin",
    ca_ppm: 115, mg_ppm: 4, na_ppm: 12, cl_ppm: 19, so4_ppm: 54, hco3_ppm: 200,
    notes: "Alkaline — dry stout (Guinness territory).",
  },
];
