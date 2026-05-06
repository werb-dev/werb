import type { MiscEntry } from "./types.ts";

/**
 * Curated miscellaneous-additions catalog. Covers the obvious set:
 * clarifiers, yeast nutrients, brewing salts, acids, and the most
 * common spice / flavor adjuncts. Default amounts assume a 20 L batch
 * and scale linearly with batch size — they're hints, not laws.
 */
export const MISCS: MiscEntry[] = [
  // ─── Clarifiers / finings ────────────────────────────────────────────
  { name: "Irish Moss", type: "fining", default_use: "add_to_boil", default_time_min: 15, default_amount: 5, default_amount_unit: "g", notes: "Helps coagulate proteins for a clearer beer." },
  { name: "Whirlfloc Tablet", type: "fining", default_use: "add_to_boil", default_time_min: 15, default_amount: 1, default_amount_unit: "g", notes: "1 tablet for 20 L; carrageenan + Irish moss." },
  { name: "Gelatin", type: "fining", default_use: "add_to_fermentation", default_time_min: 0, default_amount: 5, default_amount_unit: "g", notes: "Cold-side fining — bloom in water, pour into cold beer." },
  { name: "Biofine Clear", type: "fining", default_use: "add_to_fermentation", default_time_min: 0, default_amount: 20, default_amount_unit: "ml" },

  // ─── Yeast nutrition ─────────────────────────────────────────────────
  { name: "Yeast Nutrient (Servomyces)", type: "other", default_use: "add_to_boil", default_time_min: 10, default_amount: 1, default_amount_unit: "g", notes: "Zinc-fortified — supports yeast health." },
  { name: "Yeast Nutrient (DAP / Fermaid-K)", type: "other", default_use: "add_to_boil", default_time_min: 10, default_amount: 5, default_amount_unit: "g" },

  // ─── Water salts ─────────────────────────────────────────────────────
  { name: "Calcium Chloride (CaCl2)", type: "water_agent", default_use: "add_to_mash", default_amount: 5, default_amount_unit: "g", notes: "Boosts calcium + chloride — softens hop perception, builds malt." },
  { name: "Calcium Sulfate / Gypsum (CaSO4)", type: "water_agent", default_use: "add_to_mash", default_amount: 5, default_amount_unit: "g", notes: "Boosts calcium + sulfate — sharpens bitterness." },
  { name: "Calcium Carbonate (CaCO3)", type: "water_agent", default_use: "add_to_mash", default_amount: 2, default_amount_unit: "g", notes: "Raises mash pH — for very dark beers." },
  { name: "Magnesium Sulfate / Epsom Salt (MgSO4)", type: "water_agent", default_use: "add_to_mash", default_amount: 1, default_amount_unit: "g" },
  { name: "Sodium Chloride (NaCl)", type: "water_agent", default_use: "add_to_mash", default_amount: 1, default_amount_unit: "g", notes: "Light salinity boost — enhances body in stouts and milkshake IPAs." },
  { name: "Sodium Bicarbonate (NaHCO3)", type: "water_agent", default_use: "add_to_mash", default_amount: 2, default_amount_unit: "g", notes: "Raises mash pH and alkalinity." },

  // ─── Acids ──────────────────────────────────────────────────────────
  { name: "Lactic Acid 88%", type: "water_agent", default_use: "add_to_mash", default_amount: 2, default_amount_unit: "ml", notes: "Lower mash pH; small amounts go a long way." },
  { name: "Phosphoric Acid 10%", type: "water_agent", default_use: "add_to_mash", default_amount: 5, default_amount_unit: "ml", notes: "Lower mash pH without flavor impact." },

  // ─── Body / sweetness ────────────────────────────────────────────────
  { name: "Lactose (milk sugar)", type: "other", default_use: "add_to_boil", default_time_min: 10, default_amount: 250, default_amount_unit: "g", notes: "Unfermentable by ale yeast — adds body / sweetness in milk stouts and pastry styles." },

  // ─── Spices & flavorings ─────────────────────────────────────────────
  { name: "Coriander Seeds (crushed)", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 15, default_amount_unit: "g", notes: "Witbier classic — citrus + spice." },
  { name: "Sweet Orange Peel", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 15, default_amount_unit: "g" },
  { name: "Bitter Orange Peel", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 15, default_amount_unit: "g" },
  { name: "Cinnamon Stick", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 5, default_amount_unit: "g" },
  { name: "Star Anise", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 3, default_amount_unit: "g" },
  { name: "Ginger (fresh, grated)", type: "spice", default_use: "add_to_boil", default_time_min: 10, default_amount: 30, default_amount_unit: "g" },
  { name: "Vanilla Beans (split)", type: "flavor", default_use: "add_to_fermentation", default_amount: 2, default_amount_unit: "g", notes: "Add to secondary, soaked in vodka — bourbon stouts, pastry IPAs." },
  { name: "Cocoa Nibs", type: "flavor", default_use: "add_to_fermentation", default_amount: 100, default_amount_unit: "g", notes: "Stout / porter additions — soak in spirits if desired." },
  { name: "Coffee Beans (cold-steeped)", type: "flavor", default_use: "add_to_fermentation", default_amount: 100, default_amount_unit: "g" },
  { name: "Lemongrass", type: "herb", default_use: "add_to_boil", default_time_min: 5, default_amount: 30, default_amount_unit: "g" },
  { name: "Chamomile", type: "herb", default_use: "add_to_boil", default_time_min: 5, default_amount: 5, default_amount_unit: "g" },
  { name: "Heather Tips", type: "herb", default_use: "add_to_boil", default_time_min: 15, default_amount: 30, default_amount_unit: "g", notes: "Traditional Scottish ales (heather ale)." },

  // ─── Wood / barrel ───────────────────────────────────────────────────
  { name: "French Oak Chips (medium toast)", type: "wood", default_use: "add_to_fermentation", default_amount: 30, default_amount_unit: "g" },
  { name: "American Oak Chips (medium toast)", type: "wood", default_use: "add_to_fermentation", default_amount: 30, default_amount_unit: "g" },
  { name: "Bourbon-soaked Oak Chips", type: "wood", default_use: "add_to_fermentation", default_amount: 30, default_amount_unit: "g", notes: "Soak chips in 1-2 oz bourbon for ≥1 week before adding." },
];
