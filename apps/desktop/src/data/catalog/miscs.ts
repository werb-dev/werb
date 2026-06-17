import type { MiscEntry } from "./types.ts";

/**
 * Curated miscellaneous-additions catalog. Covers the obvious set:
 * clarifiers, yeast nutrients, brewing salts, acids, and the most
 * common spice / flavor adjuncts. Default amounts assume a 20 L batch
 * and scale linearly with batch size — they're hints, not laws.
 *
 * `aliases` carry per-locale search terms (see {@link FermentableEntry.aliases}).
 */
export const MISCS: MiscEntry[] = [
  // ─── Clarifiers / finings ────────────────────────────────────────────
  { name: "Irish Moss", type: "fining", default_use: "add_to_boil", default_time_min: 15, default_amount: 5, default_amount_unit: "g", notes: "Helps coagulate proteins for a clearer beer.", aliases: ["mousse d'Irlande"] },
  { name: "Whirlfloc Tablet", type: "fining", default_use: "add_to_boil", default_time_min: 15, default_amount: 1, default_amount_unit: "g", notes: "1 tablet for 20 L; carrageenan + Irish moss." },
  { name: "Gelatin", type: "fining", default_use: "add_to_fermentation", default_time_min: 0, default_amount: 5, default_amount_unit: "g", notes: "Cold-side fining — bloom in water, pour into cold beer.", aliases: ["gélatine"] },
  { name: "Biofine Clear", type: "fining", default_use: "add_to_fermentation", default_time_min: 0, default_amount: 20, default_amount_unit: "ml" },

  // ─── Yeast nutrition ─────────────────────────────────────────────────
  { name: "Yeast Nutrient (Servomyces)", type: "other", default_use: "add_to_boil", default_time_min: 10, default_amount: 1, default_amount_unit: "g", notes: "Zinc-fortified — add the last ~10 min of the boil per the maker's instructions.", aliases: ["nutriment de levure"] },
  { name: "Yeast Nutrient (DAP / Fermaid-K)", type: "other", default_use: "add_to_fermentation", default_time_min: 0, default_amount: 5, default_amount_unit: "g", notes: "Add at pitching (or stagger early in fermentation) — DAP / Fermaid-K aren't boil additions.", aliases: ["nutriment de levure"] },

  // ─── Water salts ─────────────────────────────────────────────────────
  { name: "Calcium Chloride (CaCl2)", type: "water_agent", default_use: "add_to_mash", default_amount: 5, default_amount_unit: "g", notes: "Boosts calcium + chloride — softens hop perception, builds malt.", aliases: ["chlorure de calcium"] },
  { name: "Calcium Sulfate / Gypsum (CaSO4)", type: "water_agent", default_use: "add_to_mash", default_amount: 5, default_amount_unit: "g", notes: "Boosts calcium + sulfate — sharpens bitterness.", aliases: ["gypse", "sulfate de calcium"] },
  { name: "Calcium Carbonate (CaCO3)", type: "water_agent", default_use: "add_to_mash", default_amount: 2, default_amount_unit: "g", notes: "Raises mash pH — for very dark beers.", aliases: ["carbonate de calcium", "craie"] },
  { name: "Magnesium Sulfate / Epsom Salt (MgSO4)", type: "water_agent", default_use: "add_to_mash", default_amount: 1, default_amount_unit: "g", aliases: ["sel d'Epsom", "sulfate de magnésium"] },
  { name: "Sodium Chloride (NaCl)", type: "water_agent", default_use: "add_to_mash", default_amount: 1, default_amount_unit: "g", notes: "Light salinity boost — enhances body in stouts and milkshake IPAs.", aliases: ["sel", "chlorure de sodium"] },
  { name: "Sodium Bicarbonate (NaHCO3)", type: "water_agent", default_use: "add_to_mash", default_amount: 2, default_amount_unit: "g", notes: "Raises mash pH and alkalinity.", aliases: ["bicarbonate de soude", "bicarbonate"] },

  // ─── Acids ──────────────────────────────────────────────────────────
  { name: "Lactic Acid 88%", type: "water_agent", default_use: "add_to_mash", default_amount: 2, default_amount_unit: "ml", notes: "Lower mash pH; small amounts go a long way.", aliases: ["acide lactique"] },
  { name: "Phosphoric Acid 10%", type: "water_agent", default_use: "add_to_mash", default_amount: 5, default_amount_unit: "ml", notes: "Lower mash pH without flavor impact.", aliases: ["acide phosphorique"] },

  // ─── Body / sweetness ────────────────────────────────────────────────
  { name: "Lactose (milk sugar)", type: "other", default_use: "add_to_boil", default_time_min: 10, default_amount: 250, default_amount_unit: "g", notes: "Unfermentable by ale yeast — adds body / sweetness in milk stouts and pastry styles.", aliases: ["lactose"] },

  // ─── Spices & flavorings ─────────────────────────────────────────────
  { name: "Coriander Seeds (crushed)", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 15, default_amount_unit: "g", notes: "Witbier classic — citrus + spice.", aliases: ["coriandre", "graines de coriandre"] },
  { name: "Sweet Orange Peel", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 15, default_amount_unit: "g", aliases: ["écorce d'orange douce", "orange"] },
  { name: "Bitter Orange Peel", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 15, default_amount_unit: "g", aliases: ["écorce d'orange amère", "orange amère"] },
  { name: "Cinnamon Stick", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 5, default_amount_unit: "g", aliases: ["cannelle"] },
  { name: "Star Anise", type: "spice", default_use: "add_to_boil", default_time_min: 5, default_amount: 3, default_amount_unit: "g", aliases: ["anis étoilé", "badiane"] },
  { name: "Ginger (fresh, grated)", type: "spice", default_use: "add_to_boil", default_time_min: 10, default_amount: 30, default_amount_unit: "g", aliases: ["gingembre"] },
  { name: "Vanilla Beans (split)", type: "flavor", default_use: "add_to_fermentation", default_amount: 2, default_amount_unit: "g", notes: "Add to secondary, soaked in vodka — bourbon stouts, pastry IPAs.", aliases: ["vanille", "gousses de vanille"] },
  { name: "Cocoa Nibs", type: "flavor", default_use: "add_to_fermentation", default_amount: 100, default_amount_unit: "g", notes: "Stout / porter additions — soak in spirits if desired.", aliases: ["fèves de cacao", "cacao"] },
  { name: "Coffee Beans (cold-steeped)", type: "flavor", default_use: "add_to_fermentation", default_amount: 100, default_amount_unit: "g", aliases: ["café", "grains de café"] },
  { name: "Lemongrass", type: "herb", default_use: "add_to_boil", default_time_min: 5, default_amount: 30, default_amount_unit: "g", aliases: ["citronnelle"] },
  { name: "Chamomile", type: "herb", default_use: "add_to_boil", default_time_min: 5, default_amount: 5, default_amount_unit: "g", aliases: ["camomille"] },
  { name: "Heather Tips", type: "herb", default_use: "add_to_boil", default_time_min: 15, default_amount: 30, default_amount_unit: "g", notes: "Traditional Scottish ales (heather ale).", aliases: ["bruyère"] },

  // ─── Wood / barrel ───────────────────────────────────────────────────
  { name: "French Oak Chips (medium toast)", type: "wood", default_use: "add_to_fermentation", default_amount: 30, default_amount_unit: "g", aliases: ["chêne français", "copeaux de chêne"] },
  { name: "American Oak Chips (medium toast)", type: "wood", default_use: "add_to_fermentation", default_amount: 30, default_amount_unit: "g", aliases: ["chêne américain", "copeaux de chêne"] },
  { name: "Bourbon-soaked Oak Chips", type: "wood", default_use: "add_to_fermentation", default_amount: 30, default_amount_unit: "g", notes: "Soak chips in 1-2 oz bourbon for ≥1 week before adding.", aliases: ["chêne au bourbon"] },
];
