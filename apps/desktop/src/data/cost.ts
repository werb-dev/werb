/**
 * Per-recipe cost estimator.
 *
 * Approximation-grade: ingredient prices come from a small bundled
 * lookup keyed on category + name pattern, anchored to typical EUR
 * homebrew supplier prices (Brouwland / Brewferm / similar EU shops).
 * Local markets vary widely; the Settings "Cost adjustment" coefficient
 * is one global multiplier that lets the brewer dial the whole basket
 * up or down. Goal is "what does this batch roughly cost" — not a
 * line-item-accurate quote.
 *
 * Pure function — no React, no IO. The Recipe screen calls it with the
 * recipe + inflation pct and renders the result.
 */

import {
  isMass,
  toGrams,
  toKilograms,
  toLiters,
  type BeerJsonRecipe,
} from "@werb/adapters";

export type CostCategory = "fermentable" | "hop" | "culture" | "misc";

/** Natural unit of the bundled default price. */
export type PriceUnit = "kg" | "g" | "pack" | "L";

export interface DefaultPrice {
  unit_price: number;
  natural_unit: PriceUnit;
}

export interface CostLine {
  category: CostCategory;
  name: string;
  amount_in_natural_unit: number | null;
  natural_unit: PriceUnit | null;
  /** Bundled baseline price for the natural unit, before inflation. */
  default_unit_price: number | null;
  /** Price actually used: the brewer's override if set, else the baseline. */
  unit_price: number | null;
  /** True when a personal price override drove this line. */
  is_override: boolean;
  /** unit_price × amount (× inflation_factor when no override). */
  line_cost: number | null;
}

/**
 * Per-install personal price overrides, keyed by {@link priceKey}. Value is
 * the price per the ingredient's natural unit (€/kg for grain, €/g for hops,
 * €/pack for yeast). Overrides bypass the global inflation coefficient — the
 * brewer typed their real price, so we use it verbatim.
 */
export type PriceOverrides = Record<string, number>;

/** Stable key for an override entry: matches the cost grouping key. */
export function priceKey(category: CostCategory, name: string): string {
  return `${category}:${name.trim().toLowerCase()}`;
}

export interface CostBreakdown {
  lines: CostLine[];
  /** Sum of priced lines, in the brewer's currency, with inflation applied. */
  total: number;
  priced_count: number;
  total_count: number;
  batch_l: number;
  per_liter: number;
  /** Per 330 mL bottle. */
  per_bottle_330: number;
}

// ─── Default-price lookup ─────────────────────────────────────────────────

function defaultPriceForFermentable(
  name: string,
  type: string | undefined,
): DefaultPrice {
  const n = name.toLowerCase();
  // Sugar / extracts (rice solids, candi, DME / LME, honey).
  if (
    type === "sugar" ||
    type === "extract" ||
    type === "dry extract" ||
    /(sugar|honey|syrup|candi|dme|lme|maltodextrin)/.test(n)
  ) {
    return { unit_price: 3.0, natural_unit: "kg" };
  }
  // Roasted / chocolate / black malts.
  if (/(roast|chocolate|black|carafa|carafe)/.test(n)) {
    return { unit_price: 3.8, natural_unit: "kg" };
  }
  // Crystal / Caramel.
  if (/(crystal|caramel|cara)/.test(n)) {
    return { unit_price: 3.5, natural_unit: "kg" };
  }
  // Specialty + character malts.
  if (/(smoked|acid|biscuit|victory|melanoidin|aromatic|honey malt|brown malt|amber|special)/.test(n)) {
    return { unit_price: 4.0, natural_unit: "kg" };
  }
  // Adjuncts (oats, rice, wheat, flaked).
  if (/(oats|rice|wheat|flaked|torrified|raw barley|spelt|rye)/.test(n)) {
    return { unit_price: 2.5, natural_unit: "kg" };
  }
  // Base malts (pilsner, pale, maris, vienna, munich, lager).
  if (/(pilsner|pilsen|pale ale|pale malt|lager|vienna|munich|maris|otter|2-row|6-row|bohemian)/.test(n)) {
    return { unit_price: 2.2, natural_unit: "kg" };
  }
  // Reasonable catch-all for grain.
  return { unit_price: 2.8, natural_unit: "kg" };
}

function defaultPriceForHop(name: string): DefaultPrice {
  const n = name.toLowerCase();
  // Premium / proprietary modern varieties.
  if (
    /(mosaic|citra|galaxy|nelson sauvin|nelson|el dorado|sabro|strata|simcoe|amarillo|idaho 7|riwaka|motueka|enigma|vic secret|cryo|incognito)/.test(
      n,
    )
  ) {
    return { unit_price: 0.07, natural_unit: "g" };
  }
  // Noble + classic European.
  if (/(saaz|hallertau|tettnang|tettnanger|spalt|fuggle|goldings|styrian|perle|hersbrucker|mittelfrüh|magnum|northern brewer)/.test(n)) {
    return { unit_price: 0.06, natural_unit: "g" };
  }
  // Standard catch-all (Cascade, Centennial, Chinook, etc.).
  return { unit_price: 0.05, natural_unit: "g" };
}

function defaultPriceForCulture(form: string | undefined): DefaultPrice {
  // Liquid yeast (smack-pack, vial, pouch) — roughly 2× a dry sachet.
  if (form === "liquid") return { unit_price: 10, natural_unit: "pack" };
  // Dry yeast and everything else (kveik, dregs) default to dry-pack
  // pricing — close enough for the approximation.
  return { unit_price: 5, natural_unit: "pack" };
}

function defaultPriceForMisc(
  name: string,
  type: string | undefined,
): DefaultPrice {
  const n = name.toLowerCase();
  // Water chemistry salts.
  if (
    type === "water agent" ||
    /(gypsum|calcium chloride|calcium sulfate|epsom|table salt|baking soda|chalk|sodium|magnesium)/.test(n)
  ) {
    return { unit_price: 0.02, natural_unit: "g" };
  }
  // Finings + clarity aids.
  if (
    type === "fining" ||
    /(irish moss|whirlfloc|biofine|gelatin|isinglass|polyclar|kettle finings)/.test(n)
  ) {
    return { unit_price: 0.1, natural_unit: "g" };
  }
  // Spices, herbs, flavor adjuncts default to the higher end since they
  // dose lighter and tend to cost more by the gram.
  return { unit_price: 0.3, natural_unit: "g" };
}

/**
 * Pick a default price for an ingredient based on its category and
 * (for hops + grains) name pattern. Exposed so tests can verify the
 * dispatch directly.
 */
export function defaultPriceFor(
  category: CostCategory,
  name: string,
  extra?: { type?: string | undefined; form?: string | undefined },
): DefaultPrice {
  switch (category) {
    case "fermentable":
      return defaultPriceForFermentable(name, extra?.type);
    case "hop":
      return defaultPriceForHop(name);
    case "culture":
      return defaultPriceForCulture(extra?.form);
    case "misc":
      return defaultPriceForMisc(name, extra?.type);
  }
}

// ─── Amount → natural unit conversion ────────────────────────────────────

function amountIn(amount: unknown, natural_unit: PriceUnit): number | null {
  if (!amount || typeof amount !== "object") return null;
  if (isMass(amount as Parameters<typeof isMass>[0])) {
    const mass = amount as Parameters<typeof toKilograms>[0];
    if (natural_unit === "kg") return toKilograms(mass);
    if (natural_unit === "g") return toGrams(mass);
    return null;
  }
  const v = amount as { value?: number; unit?: string };
  if (typeof v.value === "number" && typeof v.unit === "string") {
    if (natural_unit === "L" && /^(ml|l)$/i.test(v.unit)) {
      return toLiters(amount as Parameters<typeof toLiters>[0]);
    }
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
  extra: { type?: string | undefined; form?: string | undefined },
  inflationFactor: number,
  overrides?: PriceOverrides,
): CostLine {
  const price = defaultPriceFor(category, name, extra);
  const override = overrides?.[priceKey(category, name)];
  const is_override = typeof override === "number" && override >= 0;
  // Override is the brewer's real per-unit price → used verbatim. Baseline
  // prices are EUR-anchored estimates the inflation knob tunes globally.
  const unit_price = is_override ? override : price.unit_price;
  const qty = amountIn(amount, price.natural_unit);
  const line_cost =
    qty !== null ? qty * unit_price * (is_override ? 1 : inflationFactor) : null;
  return {
    category,
    name,
    amount_in_natural_unit: qty,
    natural_unit: price.natural_unit,
    default_unit_price: price.unit_price,
    unit_price,
    is_override,
    line_cost,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Combine raw per-addition lines into one entry per unique
 * (category, lower-cased name) pair, summing quantities and line
 * costs. The same hop at 60 min + 0 min should show once for cost
 * purposes — the brewer cares about the total spend, not how the
 * addition is split across the brew day. Display name is the first
 * capitalization encountered.
 */
function groupLines(lines: CostLine[]): CostLine[] {
  const map = new Map<string, CostLine>();
  for (const line of lines) {
    const key = `${line.category}:${line.name.trim().toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...line });
      continue;
    }
    // Both lines refer to the same ingredient — they share the price
    // and natural unit by construction (same catalog dispatch).
    if (
      existing.amount_in_natural_unit !== null &&
      line.amount_in_natural_unit !== null
    ) {
      existing.amount_in_natural_unit += line.amount_in_natural_unit;
    } else if (line.amount_in_natural_unit !== null) {
      existing.amount_in_natural_unit = line.amount_in_natural_unit;
    }
    if (existing.line_cost !== null && line.line_cost !== null) {
      existing.line_cost += line.line_cost;
    } else if (line.line_cost !== null) {
      existing.line_cost = line.line_cost;
    }
  }
  return Array.from(map.values());
}

export function computeRecipeCost(
  recipe: BeerJsonRecipe,
  cost_inflation_pct: number,
  overrides?: PriceOverrides,
): CostBreakdown {
  const factor = cost_inflation_pct / 100;
  const raw: CostLine[] = [];

  for (const f of recipe.ingredients.fermentable_additions ?? []) {
    raw.push(makeLine("fermentable", f.name, f.amount, { type: f.type }, factor, overrides));
  }
  for (const h of recipe.ingredients.hop_additions ?? []) {
    raw.push(makeLine("hop", h.name, h.amount, {}, factor, overrides));
  }
  for (const c of recipe.ingredients.culture_additions ?? []) {
    raw.push(makeLine("culture", c.name, c.amount, { form: c.form }, factor, overrides));
  }
  for (const m of recipe.ingredients.miscellaneous_additions ?? []) {
    raw.push(makeLine("misc", m.name, m.amount, { type: m.type }, factor, overrides));
  }

  const lines = groupLines(raw);
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
