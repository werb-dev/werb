import type { CultureEntry } from "./types.ts";

/**
 * Curated yeast / culture catalog. ~58 entries covering the major dry
 * brands (Fermentis, Lallemand, Mangrove Jack's), the staple White Labs
 * and Wyeast liquid strains, plus a handful of Imperial / Omega picks.
 * Attenuation and temperature ranges are from the producers' published
 * spec sheets — actual behavior depends on wort composition, pitch
 * rate, and cellar temp, so brewers should treat them as starting points.
 *
 * Default amounts: dry yeasts use grams matching their packaged size
 * (11 g for Fermentis / Lallemand, 10 g for Mangrove Jack's). Liquid
 * yeasts use `pkg` (one pouch / vial / pack) since volume varies by
 * producer and "1 pkg" is how brewers think about pitch rate.
 */
export const CULTURES: CultureEntry[] = [
  // ─── Fermentis dry (11 g packs) ──────────────────────────────────────
  { name: "Safale US-05", type: "ale", form: "dry", producer: "Fermentis", product_id: "US-05", attenuation_pct: 81, temp_min_c: 12, temp_max_c: 25, default_amount: 11, default_amount_unit: "g", notes: "Clean American ale workhorse." },
  { name: "Safale S-04", type: "ale", form: "dry", producer: "Fermentis", product_id: "S-04", attenuation_pct: 75, temp_min_c: 15, temp_max_c: 24, default_amount: 11, default_amount_unit: "g", notes: "English-style ale, fast settling." },
  { name: "Safale BE-256", type: "ale", form: "dry", producer: "Fermentis", product_id: "BE-256", attenuation_pct: 84, temp_min_c: 18, temp_max_c: 28, default_amount: 11, default_amount_unit: "g", notes: "Belgian abbey-style — strong & dry." },
  { name: "Safale BE-134", type: "ale", form: "dry", producer: "Fermentis", product_id: "BE-134", attenuation_pct: 92, temp_min_c: 18, temp_max_c: 28, default_amount: 11, default_amount_unit: "g", notes: "Belgian saison — phenolic, very high attenuation." },
  { name: "Safale K-97", type: "ale", form: "dry", producer: "Fermentis", product_id: "K-97", attenuation_pct: 81, temp_min_c: 12, temp_max_c: 25, default_amount: 11, default_amount_unit: "g", notes: "German ale / Kölsch-style — neutral, fluffy head." },
  { name: "Safale T-58", type: "ale", form: "dry", producer: "Fermentis", product_id: "T-58", attenuation_pct: 74, temp_min_c: 15, temp_max_c: 25, default_amount: 11, default_amount_unit: "g", notes: "Belgian-style, peppery & spicy phenolics." },
  { name: "Safbrew S-33", type: "ale", form: "dry", producer: "Fermentis", product_id: "S-33", attenuation_pct: 70, temp_min_c: 15, temp_max_c: 24, default_amount: 11, default_amount_unit: "g", notes: "Low attenuation — sweeter Belgians." },
  { name: "Saflager W-34/70", type: "lager", form: "dry", producer: "Fermentis", product_id: "W-34/70", attenuation_pct: 83, temp_min_c: 9, temp_max_c: 15, default_amount: 11, default_amount_unit: "g", notes: "Munich-style lager workhorse." },
  { name: "Saflager S-23", type: "lager", form: "dry", producer: "Fermentis", product_id: "S-23", attenuation_pct: 82, temp_min_c: 9, temp_max_c: 15, default_amount: 11, default_amount_unit: "g", notes: "Berlin-style lager — fruitier than 34/70." },
  { name: "SafAle F-2", type: "ale", form: "dry", producer: "Fermentis", product_id: "F-2", attenuation_pct: 90, temp_min_c: 10, temp_max_c: 20, default_amount: 11, default_amount_unit: "g", notes: "Bottle-conditioning yeast." },
  { name: "Safbrew BR-8", type: "brett", form: "dry", producer: "Fermentis", product_id: "BR-8", attenuation_pct: 70, temp_min_c: 18, temp_max_c: 28, default_amount: 11, default_amount_unit: "g", notes: "Brettanomyces bruxellensis — funky aging strain." },

  // ─── Lallemand dry (11 g packs) ──────────────────────────────────────
  { name: "LalBrew Verdant IPA", type: "ale", form: "dry", producer: "Lallemand", attenuation_pct: 80, temp_min_c: 18, temp_max_c: 23, default_amount: 11, default_amount_unit: "g", notes: "Hazy IPA — citrus / tropical biotransformation." },
  { name: "LalBrew BRY-97", type: "ale", form: "dry", producer: "Lallemand", product_id: "BRY-97", attenuation_pct: 82, temp_min_c: 15, temp_max_c: 22, default_amount: 11, default_amount_unit: "g", notes: "American West Coast ale." },
  { name: "LalBrew Voss Kveik", type: "kveik", form: "dry", producer: "Lallemand", attenuation_pct: 80, temp_min_c: 25, temp_max_c: 40, default_amount: 11, default_amount_unit: "g", notes: "Norwegian farmhouse — orange / citrus, ferments hot." },
  { name: "LalBrew Hornindal Kveik", type: "kveik", form: "dry", producer: "Lallemand", attenuation_pct: 80, temp_min_c: 23, temp_max_c: 40, default_amount: 11, default_amount_unit: "g", notes: "Tropical fruit kveik." },
  { name: "LalBrew Belle Saison", type: "ale", form: "dry", producer: "Lallemand", attenuation_pct: 90, temp_min_c: 17, temp_max_c: 35, default_amount: 11, default_amount_unit: "g", notes: "Saison — peppery, very dry." },
  { name: "LalBrew New England", type: "ale", form: "dry", producer: "Lallemand", attenuation_pct: 80, temp_min_c: 17, temp_max_c: 22, default_amount: 11, default_amount_unit: "g", notes: "Hazy IPA, soft mouthfeel." },
  { name: "LalBrew London ESB", type: "ale", form: "dry", producer: "Lallemand", attenuation_pct: 71, temp_min_c: 18, temp_max_c: 22, default_amount: 11, default_amount_unit: "g", notes: "English ale — caramel-friendly." },
  { name: "LalBrew Munich Classic", type: "wheat", form: "dry", producer: "Lallemand", attenuation_pct: 75, temp_min_c: 17, temp_max_c: 22, default_amount: 11, default_amount_unit: "g", notes: "Bavarian wheat — banana / clove." },
  { name: "LalBrew Diamond Lager", type: "lager", form: "dry", producer: "Lallemand", attenuation_pct: 80, temp_min_c: 8, temp_max_c: 15, default_amount: 11, default_amount_unit: "g", notes: "German-style lager." },
  { name: "LalBrew Nottingham", type: "ale", form: "dry", producer: "Lallemand", attenuation_pct: 80, temp_min_c: 14, temp_max_c: 21, default_amount: 11, default_amount_unit: "g", notes: "Neutral English ale, very versatile." },
  { name: "LalBrew Windsor", type: "ale", form: "dry", producer: "Lallemand", attenuation_pct: 70, temp_min_c: 14, temp_max_c: 21, default_amount: 11, default_amount_unit: "g", notes: "English ale — fruitier, less attenuative." },
  { name: "LalBrew Köln", type: "ale", form: "dry", producer: "Lallemand", attenuation_pct: 78, temp_min_c: 12, temp_max_c: 20, default_amount: 11, default_amount_unit: "g", notes: "Kölsch-style — clean, lager-like." },
  { name: "LalBrew WildBrew Philly Sour", type: "lacto", form: "dry", producer: "Lallemand", attenuation_pct: 80, temp_min_c: 20, temp_max_c: 30, default_amount: 11, default_amount_unit: "g", notes: "Lactobacillus + Saccharomyces blend — single-vessel sours." },

  // ─── Mangrove Jack's dry (10 g packs) ────────────────────────────────
  { name: "Mangrove Jack's M44 US West Coast", type: "ale", form: "dry", producer: "Mangrove Jack's", product_id: "M44", attenuation_pct: 80, temp_min_c: 18, temp_max_c: 25, default_amount: 10, default_amount_unit: "g", notes: "Clean American ale." },
  { name: "Mangrove Jack's M21 Belgian Wit", type: "ale", form: "dry", producer: "Mangrove Jack's", product_id: "M21", attenuation_pct: 75, temp_min_c: 18, temp_max_c: 25, default_amount: 10, default_amount_unit: "g" },
  { name: "Mangrove Jack's M27 Belgian Ale", type: "ale", form: "dry", producer: "Mangrove Jack's", product_id: "M27", attenuation_pct: 80, temp_min_c: 18, temp_max_c: 25, default_amount: 10, default_amount_unit: "g" },
  { name: "Mangrove Jack's M31 Belgian Tripel", type: "ale", form: "dry", producer: "Mangrove Jack's", product_id: "M31", attenuation_pct: 84, temp_min_c: 18, temp_max_c: 28, default_amount: 10, default_amount_unit: "g" },
  { name: "Mangrove Jack's M76 Bavarian Wheat", type: "wheat", form: "dry", producer: "Mangrove Jack's", product_id: "M76", attenuation_pct: 75, temp_min_c: 16, temp_max_c: 24, default_amount: 10, default_amount_unit: "g" },
  { name: "Mangrove Jack's M42 New World Strong Ale", type: "ale", form: "dry", producer: "Mangrove Jack's", product_id: "M42", attenuation_pct: 80, temp_min_c: 18, temp_max_c: 28, default_amount: 10, default_amount_unit: "g" },

  // ─── White Labs liquid (1 pouch) ─────────────────────────────────────
  { name: "WLP001 California Ale", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP001", attenuation_pct: 78, temp_min_c: 20, temp_max_c: 23, default_amount: 1, default_amount_unit: "pkg", notes: "Clean American ale standard." },
  { name: "WLP002 English Ale", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP002", attenuation_pct: 67, temp_min_c: 18, temp_max_c: 20, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP004 Irish Ale", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP004", attenuation_pct: 72, temp_min_c: 18, temp_max_c: 20, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP013 London Ale", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP013", attenuation_pct: 70, temp_min_c: 18, temp_max_c: 21, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP028 Edinburgh Scottish Ale", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP028", attenuation_pct: 72, temp_min_c: 18, temp_max_c: 23, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP029 German Ale / Kölsch", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP029", attenuation_pct: 75, temp_min_c: 18, temp_max_c: 21, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP500 Trappist Ale", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP500", attenuation_pct: 78, temp_min_c: 18, temp_max_c: 24, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP530 Abbey Ale", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP530", attenuation_pct: 80, temp_min_c: 18, temp_max_c: 23, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP800 Pilsner Lager", type: "lager", form: "liquid", producer: "White Labs", product_id: "WLP800", attenuation_pct: 75, temp_min_c: 10, temp_max_c: 13, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP838 Southern German Lager", type: "lager", form: "liquid", producer: "White Labs", product_id: "WLP838", attenuation_pct: 73, temp_min_c: 10, temp_max_c: 13, default_amount: 1, default_amount_unit: "pkg" },
  { name: "WLP060 American Ale Blend", type: "ale", form: "liquid", producer: "White Labs", product_id: "WLP060", attenuation_pct: 78, temp_min_c: 18, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },

  // ─── Wyeast liquid (1 smack-pack) ────────────────────────────────────
  { name: "Wyeast 1056 American Ale", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1056", attenuation_pct: 76, temp_min_c: 16, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg", notes: "Equivalent to WLP001 / US-05." },
  { name: "Wyeast 1084 Irish Ale", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1084", attenuation_pct: 73, temp_min_c: 16, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 1098 British Ale", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1098", attenuation_pct: 75, temp_min_c: 18, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 1272 American Ale II", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1272", attenuation_pct: 76, temp_min_c: 16, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 1318 London Ale III", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1318", attenuation_pct: 73, temp_min_c: 18, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg", notes: "Beloved hazy IPA strain." },
  { name: "Wyeast 1335 British Ale II", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1335", attenuation_pct: 74, temp_min_c: 17, temp_max_c: 23, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 1450 Denny's Favorite 50", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1450", attenuation_pct: 73, temp_min_c: 16, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 1968 London ESB", type: "ale", form: "liquid", producer: "Wyeast", product_id: "1968", attenuation_pct: 70, temp_min_c: 18, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 2206 Bavarian Lager", type: "lager", form: "liquid", producer: "Wyeast", product_id: "2206", attenuation_pct: 75, temp_min_c: 8, temp_max_c: 14, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 2278 Czech Pils", type: "lager", form: "liquid", producer: "Wyeast", product_id: "2278", attenuation_pct: 74, temp_min_c: 8, temp_max_c: 14, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Wyeast 3068 Weihenstephan Weizen", type: "wheat", form: "liquid", producer: "Wyeast", product_id: "3068", attenuation_pct: 75, temp_min_c: 17, temp_max_c: 23, default_amount: 1, default_amount_unit: "pkg", notes: "Banana / clove balance is temperature-sensitive." },

  // ─── Imperial / Omega selects (1 pouch) ──────────────────────────────
  { name: "Imperial A07 Flagship", type: "ale", form: "liquid", producer: "Imperial", product_id: "A07", attenuation_pct: 75, temp_min_c: 16, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Imperial A09 Pub", type: "ale", form: "liquid", producer: "Imperial", product_id: "A09", attenuation_pct: 73, temp_min_c: 16, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Imperial A38 Juice", type: "ale", form: "liquid", producer: "Imperial", product_id: "A38", attenuation_pct: 75, temp_min_c: 18, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg", notes: "Hazy IPA strain — biotransformation-friendly." },
  { name: "Omega OYL-052 DIPA Ale", type: "ale", form: "liquid", producer: "Omega Yeast", product_id: "OYL-052", attenuation_pct: 80, temp_min_c: 18, temp_max_c: 22, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Omega OYL-061 Voss Kveik", type: "kveik", form: "liquid", producer: "Omega Yeast", product_id: "OYL-061", attenuation_pct: 80, temp_min_c: 25, temp_max_c: 38, default_amount: 1, default_amount_unit: "pkg" },
  { name: "Omega OYL-205 Lutra Kveik", type: "kveik", form: "liquid", producer: "Omega Yeast", product_id: "OYL-205", attenuation_pct: 80, temp_min_c: 22, temp_max_c: 35, default_amount: 1, default_amount_unit: "pkg", notes: "Clean kveik — lager-like at ale temps." },
];
