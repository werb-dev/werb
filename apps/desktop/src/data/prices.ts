/**
 * Global price catalog — ingredient name → unit price.
 *
 * The brewer sets a price once per ingredient ("Mosaic = €0.04/g") and
 * every recipe using that ingredient picks it up automatically. Stored
 * under `werb.prices` so it syncs through the existing GitHub backup
 * path along with recipes / sessions / equipment.
 *
 * Keys are normalized to lower-case + trimmed so "Mosaic", "mosaic ",
 * and "MOSAIC" all resolve to the same entry. Imported BeerJSON / XML
 * recipes vary wildly in capitalization; the normalization keeps the
 * catalog small.
 *
 * `natural_unit` records the unit the brewer typed the price in
 * (€/kg vs €/g vs €/pack). Cost calc converts the recipe's ingredient
 * amount into that same unit before multiplying.
 */

export type PriceUnit = "kg" | "g" | "pack" | "L";

export interface PriceEntry {
  /** Lower-cased + trimmed ingredient name. */
  key: string;
  /** Price per `natural_unit`, in the user's currency. */
  unit_price: number;
  natural_unit: PriceUnit;
  /** ISO timestamp of the last edit. Useful for sync conflict heuristics later. */
  updated_at?: string;
}

export interface PriceCatalog {
  prices: PriceEntry[];
}

export const PRICES_STORAGE_KEY = "werb.prices";

export const EMPTY_CATALOG: PriceCatalog = { prices: [] };

export function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

export function findPrice(
  catalog: PriceCatalog,
  name: string,
): PriceEntry | undefined {
  const key = normalizeKey(name);
  return catalog.prices.find((p) => p.key === key);
}

export function upsertPrice(
  catalog: PriceCatalog,
  name: string,
  unit_price: number,
  natural_unit: PriceUnit,
): PriceCatalog {
  const key = normalizeKey(name);
  const updated_at = new Date().toISOString();
  const idx = catalog.prices.findIndex((p) => p.key === key);
  if (idx >= 0) {
    const next = catalog.prices.slice();
    next[idx] = { key, unit_price, natural_unit, updated_at };
    return { prices: next };
  }
  return {
    prices: [...catalog.prices, { key, unit_price, natural_unit, updated_at }],
  };
}

export function removePrice(catalog: PriceCatalog, name: string): PriceCatalog {
  const key = normalizeKey(name);
  return { prices: catalog.prices.filter((p) => p.key !== key) };
}
