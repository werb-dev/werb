import type { HopEntry } from "./types.ts";

/**
 * Curated hop catalog. ~55 entries spanning American C-hops, modern
 * stone-fruit / citrus US varieties, German noble + modern aroma,
 * English heritage, and AU/NZ. Alpha-acid percentages are typical
 * mid-range values from grower spec sheets — alpha varies meaningfully
 * by harvest year, so the brewer should sanity-check against the bag.
 */
export const HOPS: HopEntry[] = [
  // ─── US classic / dual-purpose ───────────────────────────────────────
  { name: "Cascade", alpha_acid_pct: 5.5, hop_type: "dual", origin: "US", notes: "Citrus, grapefruit, floral — the original American IPA hop." },
  { name: "Centennial", alpha_acid_pct: 10, hop_type: "dual", origin: "US", notes: "Floral citrus, sometimes called Super Cascade." },
  { name: "Chinook", alpha_acid_pct: 13, hop_type: "dual", origin: "US", notes: "Pine, grapefruit, spicy." },
  { name: "Columbus", alpha_acid_pct: 14, hop_type: "bittering", origin: "US", notes: "Resinous, dank — also sold as Tomahawk / Zeus (CTZ)." },
  { name: "Magnum", alpha_acid_pct: 13, hop_type: "bittering", origin: "US", notes: "Clean bittering workhorse." },
  { name: "Galena", alpha_acid_pct: 13, hop_type: "bittering", origin: "US", notes: "Berry, citrus, clean bittering." },
  { name: "Nugget", alpha_acid_pct: 13, hop_type: "bittering", origin: "US", notes: "Herbal, slightly resinous." },
  { name: "Warrior", alpha_acid_pct: 16, hop_type: "bittering", origin: "US", notes: "High alpha, neutral aroma — clean bittering." },
  { name: "Cluster", alpha_acid_pct: 7, hop_type: "dual", origin: "US", notes: "Heritage US — pungent, blackcurrant." },
  { name: "Willamette", alpha_acid_pct: 5, hop_type: "aroma", origin: "US", notes: "Mild floral, herbal — US Fuggle." },
  { name: "Liberty", alpha_acid_pct: 4, hop_type: "aroma", origin: "US", notes: "Hallertauer-derived noble-style." },
  { name: "Mt Hood", alpha_acid_pct: 5, hop_type: "aroma", origin: "US", notes: "Clean, mild noble character." },
  { name: "Crystal", alpha_acid_pct: 4, hop_type: "aroma", origin: "US", notes: "Spicy, floral, noble-style." },

  // ─── US modern / aroma stars ─────────────────────────────────────────
  { name: "Citra", alpha_acid_pct: 12, hop_type: "aroma", origin: "US", notes: "Tropical, mango, passion fruit, citrus zest." },
  { name: "Mosaic", alpha_acid_pct: 12, hop_type: "aroma", origin: "US", notes: "Berry, tropical, pine, complex." },
  { name: "Simcoe", alpha_acid_pct: 13, hop_type: "dual", origin: "US", notes: "Pine, passion fruit, apricot." },
  { name: "Amarillo", alpha_acid_pct: 9, hop_type: "aroma", origin: "US", notes: "Orange, peach, floral." },
  { name: "Strata", alpha_acid_pct: 12, hop_type: "aroma", origin: "US", notes: "Strawberry, dank, tropical." },
  { name: "Sabro", alpha_acid_pct: 14, hop_type: "aroma", origin: "US", notes: "Coconut, tangerine, cedar — polarising." },
  { name: "Idaho 7", alpha_acid_pct: 11, hop_type: "dual", origin: "US", notes: "Apricot, tropical, pine, black tea." },
  { name: "Calypso", alpha_acid_pct: 13, hop_type: "dual", origin: "US", notes: "Pear, apple, lemon zest." },
  { name: "Eclipse", alpha_acid_pct: 17, hop_type: "dual", origin: "US", notes: "Mandarin orange, raisin." },
  { name: "El Dorado", alpha_acid_pct: 14, hop_type: "dual", origin: "US", notes: "Watermelon, candy, pear." },
  { name: "Galaxy", alpha_acid_pct: 14, hop_type: "aroma", origin: "AU", notes: "Passion fruit, peach, citrus." },
  { name: "Vic Secret", alpha_acid_pct: 16, hop_type: "aroma", origin: "AU", notes: "Pineapple, passion fruit, pine." },
  { name: "Ella", alpha_acid_pct: 14, hop_type: "aroma", origin: "AU", notes: "Floral, anise, grapefruit." },

  // ─── German noble + modern German aroma ──────────────────────────────
  { name: "Hallertauer Mittelfrüh", alpha_acid_pct: 4, hop_type: "aroma", origin: "DE", notes: "Classic German noble — herbal, floral." },
  { name: "Tettnanger", alpha_acid_pct: 4.5, hop_type: "aroma", origin: "DE", notes: "Spicy, mildly floral noble." },
  { name: "Saaz", alpha_acid_pct: 3.5, hop_type: "aroma", origin: "CZ", notes: "Earthy, herbal — defining Pilsner aroma." },
  { name: "Spalt", alpha_acid_pct: 4.5, hop_type: "aroma", origin: "DE", notes: "Mild, slightly fruity noble." },
  { name: "Hersbrucker", alpha_acid_pct: 3.5, hop_type: "aroma", origin: "DE", notes: "Clean, mild floral noble." },
  { name: "Perle", alpha_acid_pct: 8, hop_type: "dual", origin: "DE", notes: "Slightly spicy, noble character at higher alpha." },
  { name: "Tradition", alpha_acid_pct: 5.5, hop_type: "aroma", origin: "DE", notes: "Hallertauer-style, modern aroma." },
  { name: "Mandarina Bavaria", alpha_acid_pct: 8.5, hop_type: "aroma", origin: "DE", notes: "Tangerine, sweet citrus." },
  { name: "Hallertau Blanc", alpha_acid_pct: 10, hop_type: "aroma", origin: "DE", notes: "White wine, gooseberry, lemongrass." },
  { name: "Hüll Melon", alpha_acid_pct: 7, hop_type: "aroma", origin: "DE", notes: "Honeydew melon, strawberry." },
  { name: "Polaris", alpha_acid_pct: 20, hop_type: "bittering", origin: "DE", notes: "Mint, eucalyptus — very high alpha." },
  { name: "Callista", alpha_acid_pct: 5, hop_type: "aroma", origin: "DE", notes: "Pineapple, peach, ripe pear." },

  // ─── English heritage ────────────────────────────────────────────────
  { name: "East Kent Goldings", alpha_acid_pct: 5, hop_type: "aroma", origin: "UK", notes: "Earthy, floral, honey — classic English." },
  { name: "Fuggles", alpha_acid_pct: 4.5, hop_type: "aroma", origin: "UK", notes: "Earthy, woody, mildly minty." },
  { name: "Target", alpha_acid_pct: 11, hop_type: "dual", origin: "UK", notes: "Marmalade, sage, pungent." },
  { name: "Challenger", alpha_acid_pct: 7.5, hop_type: "dual", origin: "UK", notes: "Spicy, cedar, marmalade." },
  { name: "First Gold", alpha_acid_pct: 8, hop_type: "dual", origin: "UK", notes: "Citrus, marmalade — Goldings dwarf variant." },
  { name: "Bramling Cross", alpha_acid_pct: 6, hop_type: "aroma", origin: "UK", notes: "Blackcurrant, lemon, spicy." },
  { name: "Pilgrim", alpha_acid_pct: 11, hop_type: "dual", origin: "UK", notes: "Berry, lemon, grapefruit." },
  { name: "Northern Brewer", alpha_acid_pct: 8.5, hop_type: "dual", origin: "UK", notes: "Pine, mint, herbal." },

  // ─── French ──────────────────────────────────────────────────────────
  { name: "Strisselspalt", alpha_acid_pct: 3.5, hop_type: "aroma", origin: "FR", notes: "Alsatian noble-style — floral, spicy, mildly fruity. The classic French aroma hop." },
  { name: "Aramis", alpha_acid_pct: 7.5, hop_type: "dual", origin: "FR", notes: "Strisselspalt × Whitbread Golding — herbal, spicy, mild citrus." },
  { name: "Triskel", alpha_acid_pct: 7, hop_type: "aroma", origin: "FR", notes: "Strisselspalt × Yeoman — floral, citrus, peach." },
  { name: "Barbe Rouge", alpha_acid_pct: 9, hop_type: "aroma", origin: "FR", notes: "Red-berry / raspberry character — distinctive French aroma." },
  { name: "Mistral", alpha_acid_pct: 8.5, hop_type: "aroma", origin: "FR", notes: "Citrus, gooseberry, white wine — Loire valley." },
  { name: "Elixir", alpha_acid_pct: 8, hop_type: "dual", origin: "FR", notes: "Floral, fruity, mild citrus." },
  { name: "Teorem T45", alpha_acid_pct: 15, hop_type: "dual", origin: "FR", notes: "High-alpha modern French — tropical, citrus, dank." },

  // ─── New Zealand / Pacific ───────────────────────────────────────────
  { name: "Nelson Sauvin", alpha_acid_pct: 12, hop_type: "aroma", origin: "NZ", notes: "Sauvignon Blanc, gooseberry, white wine." },
  { name: "Motueka", alpha_acid_pct: 7, hop_type: "aroma", origin: "NZ", notes: "Lime, lemon, tropical." },
  { name: "Riwaka", alpha_acid_pct: 5.5, hop_type: "aroma", origin: "NZ", notes: "Intense grapefruit, passion fruit." },
  { name: "Pacific Jade", alpha_acid_pct: 13, hop_type: "dual", origin: "NZ", notes: "Citrus, fresh pepper." },
  { name: "Wai-iti", alpha_acid_pct: 3, hop_type: "aroma", origin: "NZ", notes: "Mandarin, peach, low-alpha aroma." },
  { name: "Wakatu", alpha_acid_pct: 7, hop_type: "aroma", origin: "NZ", notes: "Lime, floral, tropical." },
];
