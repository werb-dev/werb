import type { FermentableEntry } from "./types.ts";

/**
 * Curated fermentable catalog. ~55 entries covering bases, specialty
 * malts, roasted malts, adjuncts, and sugars/extracts. Color in EBC,
 * yield in % fine grind. Values are typical vendor spec-sheet figures —
 * a Pilsner from Weyermann vs Castle vs Dingemans differ by ±0.5 EBC
 * but the right number is whatever the brewer's actual sack says.
 */
export const FERMENTABLES: FermentableEntry[] = [
  // ─── Base malts ──────────────────────────────────────────────────────
  { name: "Pilsner Malt", type: "grain", color_ebc: 3, yield_pct: 81, producer: "Weyermann", origin: "DE" },
  { name: "Pilsner Malt", type: "grain", color_ebc: 4, yield_pct: 81, producer: "Dingemans", origin: "BE" },
  { name: "Pilsner Malt", type: "grain", color_ebc: 4, yield_pct: 81, producer: "Castle", origin: "BE" },
  { name: "Pilsner Malt", type: "grain", color_ebc: 4, yield_pct: 81, producer: "Best Malz", origin: "DE" },
  { name: "Pale Ale Malt", type: "grain", color_ebc: 6, yield_pct: 80, producer: "Weyermann", origin: "DE" },
  { name: "Pale Ale Malt 2-Row", type: "grain", color_ebc: 4, yield_pct: 80, producer: "Briess", origin: "US" },
  { name: "Maris Otter", type: "grain", color_ebc: 7, yield_pct: 81, producer: "Crisp", origin: "UK" },
  { name: "Golden Promise", type: "grain", color_ebc: 6, yield_pct: 80, producer: "Simpsons", origin: "UK" },
  { name: "Vienna Malt", type: "grain", color_ebc: 7, yield_pct: 80, producer: "Weyermann", origin: "DE" },
  { name: "Munich Malt Light", type: "grain", color_ebc: 15, yield_pct: 79, producer: "Weyermann", origin: "DE" },
  { name: "Munich Malt Dark", type: "grain", color_ebc: 25, yield_pct: 79, producer: "Weyermann", origin: "DE" },
  { name: "Wheat Malt Pale", type: "grain", color_ebc: 5, yield_pct: 82, producer: "Weyermann", origin: "DE" },
  { name: "Wheat Malt Dark", type: "grain", color_ebc: 18, yield_pct: 81, producer: "Weyermann", origin: "DE" },
  { name: "Rye Malt", type: "grain", color_ebc: 7, yield_pct: 78, producer: "Weyermann", origin: "DE" },
  { name: "Acidulated Malt (Sauermalz)", type: "grain", color_ebc: 4, yield_pct: 75, producer: "Weyermann", origin: "DE" },
  { name: "Smoked Malt (Rauchmalz)", type: "grain", color_ebc: 5, yield_pct: 80, producer: "Weyermann", origin: "DE" },

  // ─── Crystal / caramel ───────────────────────────────────────────────
  { name: "Crystal 10L", type: "grain", color_ebc: 25, yield_pct: 76, producer: "Crisp", origin: "UK" },
  { name: "Crystal 30L", type: "grain", color_ebc: 80, yield_pct: 75, producer: "Crisp", origin: "UK" },
  { name: "Crystal 60L", type: "grain", color_ebc: 145, yield_pct: 74, producer: "Crisp", origin: "UK" },
  { name: "Crystal 80L", type: "grain", color_ebc: 195, yield_pct: 74, producer: "Crisp", origin: "UK" },
  { name: "Crystal 120L", type: "grain", color_ebc: 290, yield_pct: 72, producer: "Crisp", origin: "UK" },
  { name: "CaraPils / Carafoam", type: "grain", color_ebc: 4, yield_pct: 75, producer: "Weyermann", origin: "DE" },
  { name: "CaraHell", type: "grain", color_ebc: 25, yield_pct: 75, producer: "Weyermann", origin: "DE" },
  { name: "CaraMunich I", type: "grain", color_ebc: 80, yield_pct: 76, producer: "Weyermann", origin: "DE" },
  { name: "CaraMunich II", type: "grain", color_ebc: 110, yield_pct: 75, producer: "Weyermann", origin: "DE" },
  { name: "CaraMunich III", type: "grain", color_ebc: 150, yield_pct: 75, producer: "Weyermann", origin: "DE" },
  { name: "CaraVienne", type: "grain", color_ebc: 50, yield_pct: 75, producer: "Dingemans", origin: "BE" },
  { name: "CaraAroma", type: "grain", color_ebc: 350, yield_pct: 73, producer: "Weyermann", origin: "DE" },
  { name: "Special B", type: "grain", color_ebc: 280, yield_pct: 72, producer: "Dingemans", origin: "BE" },
  { name: "Honey Malt", type: "grain", color_ebc: 50, yield_pct: 78, producer: "Gambrinus", origin: "CA" },
  { name: "Biscuit Malt", type: "grain", color_ebc: 50, yield_pct: 78, producer: "Dingemans", origin: "BE" },
  { name: "Aromatic Malt", type: "grain", color_ebc: 50, yield_pct: 78, producer: "Dingemans", origin: "BE" },
  { name: "Victory Malt", type: "grain", color_ebc: 55, yield_pct: 78, producer: "Briess", origin: "US" },
  { name: "Melanoidin Malt", type: "grain", color_ebc: 65, yield_pct: 77, producer: "Weyermann", origin: "DE" },

  // ─── Roasted ─────────────────────────────────────────────────────────
  { name: "Pale Chocolate Malt", type: "grain", color_ebc: 500, yield_pct: 70, producer: "Crisp", origin: "UK" },
  { name: "Chocolate Malt", type: "grain", color_ebc: 900, yield_pct: 68, producer: "Crisp", origin: "UK" },
  { name: "Black Patent", type: "grain", color_ebc: 1300, yield_pct: 65, producer: "Crisp", origin: "UK" },
  { name: "Roasted Barley", type: "grain", color_ebc: 1300, yield_pct: 67, producer: "Crisp", origin: "UK" },
  { name: "Carafa I (dehusked)", type: "grain", color_ebc: 800, yield_pct: 70, producer: "Weyermann", origin: "DE" },
  { name: "Carafa II (dehusked)", type: "grain", color_ebc: 1100, yield_pct: 70, producer: "Weyermann", origin: "DE" },
  { name: "Carafa III (dehusked)", type: "grain", color_ebc: 1400, yield_pct: 70, producer: "Weyermann", origin: "DE" },

  // ─── Adjuncts (flaked / unmalted) ────────────────────────────────────
  { name: "Flaked Oats", type: "other", color_ebc: 4, yield_pct: 70, notes: "Adds body and silky mouthfeel" },
  { name: "Flaked Wheat", type: "other", color_ebc: 4, yield_pct: 75 },
  { name: "Flaked Barley", type: "other", color_ebc: 3, yield_pct: 70 },
  { name: "Flaked Rye", type: "other", color_ebc: 6, yield_pct: 70 },
  { name: "Flaked Corn (Maize)", type: "other", color_ebc: 2, yield_pct: 80 },
  { name: "Rice Hulls", type: "other", color_ebc: 0, yield_pct: 0, notes: "No fermentables — anti-stuck-mash filter bed" },
  { name: "Torrified Wheat", type: "other", color_ebc: 4, yield_pct: 76 },
  { name: "Raw Wheat", type: "other", color_ebc: 4, yield_pct: 70 },

  // ─── Sugars & extracts ───────────────────────────────────────────────
  { name: "Cane Sugar (sucrose)", type: "sugar", color_ebc: 0, yield_pct: 100 },
  { name: "Brown Sugar", type: "sugar", color_ebc: 30, yield_pct: 100 },
  { name: "Belgian Candi Syrup Clear", type: "sugar", color_ebc: 0, yield_pct: 80 },
  { name: "Belgian Candi Syrup D-180", type: "sugar", color_ebc: 350, yield_pct: 80 },
  { name: "Honey", type: "honey", color_ebc: 4, yield_pct: 75 },
  { name: "Maple Syrup", type: "sugar", color_ebc: 70, yield_pct: 65 },
  { name: "Lactose (milk sugar)", type: "sugar", color_ebc: 0, yield_pct: 100, notes: "Unfermentable by ale yeast — adds body and sweetness" },
  { name: "Maltodextrin", type: "sugar", color_ebc: 0, yield_pct: 100, notes: "Largely unfermentable — body builder" },
  { name: "Pilsen Liquid Malt Extract", type: "extract", color_ebc: 8, yield_pct: 78 },
  { name: "Pilsen Dry Malt Extract", type: "dry extract", color_ebc: 7, yield_pct: 80 },
  { name: "Munich Liquid Malt Extract", type: "extract", color_ebc: 18, yield_pct: 78 },
  { name: "Wheat Liquid Malt Extract", type: "extract", color_ebc: 10, yield_pct: 78 },
];
