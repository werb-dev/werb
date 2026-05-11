/**
 * Per-recipe cost breakdown.
 *
 * Walks every priced ingredient (fermentables, hops, cultures, miscs),
 * looks up its unit price in the global catalog, converts the recipe's
 * amount into the catalog's natural unit, and sums into a total. Lines
 * with no catalog entry are returned as `unpriced` so the UI can prompt
 * the brewer to set a price inline.
 *
 * Pure function — no IO, no React. The Recipe screen calls it with the
 * live catalog + recipe, then renders the result.
 */

import {
  isMass,
  toGrams,
  toKilograms,
  toLiters,
  type BeerJsonRecipe,
} from "@werb/adapters";
import {
  findPrice,
  type PriceCatalog,
  type PriceEntry,
  type PriceUnit,
} from "./prices.ts";

export type CostCategory = "fermentable" | "hop" | "culture" | "misc";

export interface CostLine {
  category: CostCategory;
  name: string;
  /**
   * Best-effort amount in the catalog's natural unit. For mass items
   * we always have a numeric value; for cultures/miscs with unit-count
   * amounts we use the count directly when natural_unit is "pack".
   */
  amount_in_natural_unit: number | null;
  natural_unit: PriceUnit | null;
  /** Catalog entry, when one exists for this ingredient name. */
  price: PriceEntry | null;
  /** unit_price × amount_in_natural_unit when both are known. */
  line_cost: number | null;
}

export interface CostBreakdown {
  lines: CostLine[];
  /** Sum of priced lines. */
  total: number;
  /** How many lines we managed to price. */
  priced_count: number;
  total_count: number;
  batch_l: number;
  per_liter: number;
  /** Per 330 mL bottle — the common European bottle size. */
  per_bottle_330: number;
}

/**
 * Convert a recipe-side ingredient amount into the catalog entry's
 * natural unit. Returns null when the conversion isn't possible
 * (e.g. a hop priced per pack but listed by mass — we'd need a
 * separate "g per pack" hint that we don't track yet).
 */
function amountIn(
  amount: unknown,
  natural_unit: PriceUnit,
): number | null {
  if (!amount || typeof amount !== "object") return null;
  if (isMass(amount as Parameters<typeof isMass>[0])) {
    const mass = amount as Parameters<typeof toKilograms>[0];
    if (natural_unit === "kg") return toKilograms(mass);
    if (natural_unit === "g") return toGrams(mass);
    return null;
  }
  // Volume-based amounts (some misc additions: water salts in mL,
  // brett tinctures, etc.).
  const v = amount as { value?: number; unit?: string };
  if (typeof v.value === "number" && typeof v.unit === "string") {
    if (natural_unit === "L" && /^(ml|l)$/i.test(v.unit)) {
      return toLiters(amount as Parameters<typeof toLiters>[0]);
    }
    // Unit-count amounts (pkg / each) for yeast packs.
    if (
      natural_unit === "pack" &&
      /^(pkg|unit|each|dimensionless|1)$/i.test(v.unit)
    ) {
      return v.value;
    }
  }
  return null;
}

function makeLine(
  category: CostCategory,
  name: string,
  amount: unknown,
  catalog: PriceCatalog,
): CostLine {
  const price = findPrice(catalog, name) ?? null;
  if (!price) {
    return {
      category,
      name,
      amount_in_natural_unit: null,
      natural_unit: null,
      price: null,
      line_cost: null,
    };
  }
  const qty = amountIn(amount, price.natural_unit);
  return {
    category,
    name,
    amount_in_natural_unit: qty,
    natural_unit: price.natural_unit,
    price,
    line_cost: qty !== null ? qty * price.unit_price : null,
  };
}

export function computeRecipeCost(
  recipe: BeerJsonRecipe,
  catalog: PriceCatalog,
): CostBreakdown {
  const lines: CostLine[] = [];

  for (const f of recipe.ingredients.fermentable_additions ?? []) {
    lines.push(makeLine("fermentable", f.name, f.amount, catalog));
  }
  for (const h of recipe.ingredients.hop_additions ?? []) {
    lines.push(makeLine("hop", h.name, h.amount, catalog));
  }
  for (const c of recipe.ingredients.culture_additions ?? []) {
    lines.push(makeLine("culture", c.name, c.amount, catalog));
  }
  for (const m of recipe.ingredients.miscellaneous_additions ?? []) {
    lines.push(makeLine("misc", m.name, m.amount, catalog));
  }

  const priced = lines.filter((l) => l.line_cost !== null);
  const total = priced.reduce((sum, l) => sum + (l.line_cost ?? 0), 0);
  const batch_l = toLiters(recipe.batch_size);
  const per_liter = batch_l > 0 ? total / batch_l : 0;
  const per_bottle_330 = batch_l > 0 ? total * (0.33 / batch_l) : 0;

  return {
    lines,
    total,
    priced_count: priced.length,
    total_count: lines.length,
    batch_l,
    per_liter,
    per_bottle_330,
  };
}
