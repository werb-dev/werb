/**
 * Personal stock / inventory layer.
 *
 * The catalog ships typical spec-sheet figures (hop alpha %, malt EBC +
 * yield, yeast attenuation), but the bag in your freezer rarely matches:
 * this year's Cascade might be 7.2 % alpha, not the catalog's 5.5 %.
 * The catalog is intentionally immutable from the app (SPEC principle
 * #7), so personal numbers live here — a per-install stock list whose
 * entries *override* the catalog/recipe defaults whenever a recipe
 * references that ingredient by name.
 *
 * Overrides are applied at display/compute time only — they are never
 * written back into the BeerJSON recipe, so recipes stay portable and a
 * recipe shared with another brewer keeps its own values. (Mirrors how
 * the per-install price overrides from #2 work.)
 *
 * Storage mirrors the equipment layer: one JSON blob behind a
 * StorageBackend, each item with a stable id.
 */

import type { BeerJsonRecipe } from "@werb/adapters";
import type { StorageBackend } from "../storage/index.ts";

export type InventoryCategory = "fermentable" | "hop" | "culture" | "misc";

/**
 * One thing the brewer owns. Every override field is optional — the
 * brewer fills in only the characteristics they actually measured /
 * read off the bag; an unset field falls through to the recipe/catalog
 * value. Matching to recipe ingredients is by (category, case-folded
 * name) via {@link inventoryKey}.
 */
export interface InventoryItem {
  id: string;
  category: InventoryCategory;
  name: string;

  // Every override is optional; `| undefined` is deliberate so a field
  // can be explicitly cleared in a patch under exactOptionalPropertyTypes.

  // Hops
  /** Measured alpha-acid %. Drives IBU. */
  alpha_acid_pct?: number | undefined;
  /** Crop year. */
  year?: number | undefined;

  // Fermentables
  /** Measured color in EBC. Drives SRM/EBC. */
  color_ebc?: number | undefined;
  /** Fine-grind yield %. Drives OG. */
  yield_pct?: number | undefined;

  // Hops (pellet / leaf / …) or cultures (dry / liquid / slurry).
  form?: string | undefined;

  // Cultures
  /** Apparent attenuation %. Drives FG. */
  attenuation_pct?: number | undefined;
  /** Best-by / production date (ISO yyyy-mm-dd) for the viability hint. */
  viability_date?: string | undefined;

  // Stock tracking (optional, free-form for now).
  quantity?: number | undefined;
  quantity_unit?: string | undefined;
  notes?: string | undefined;
}

interface InventoryStore {
  items: InventoryItem[];
}

export const INVENTORY_STORAGE_KEY = "werb.inventory";

const EMPTY_STORE: InventoryStore = { items: [] };

const CATEGORIES: ReadonlySet<string> = new Set([
  "fermentable",
  "hop",
  "culture",
  "misc",
]);

function isItem(x: unknown): x is InventoryItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.category === "string" &&
    CATEGORIES.has(o.category)
  );
}

function parseStore(raw: string | null): InventoryStore {
  if (!raw) return EMPTY_STORE;
  try {
    const parsed = JSON.parse(raw) as Partial<InventoryStore>;
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isItem) : [];
    return { items };
  } catch {
    return EMPTY_STORE;
  }
}

/** Sync hydration for hooks; empty when the backend has no readSync. */
export function loadStoreSync(backend: StorageBackend): InventoryStore {
  if (!backend.readSync) return EMPTY_STORE;
  return parseStore(backend.readSync(INVENTORY_STORAGE_KEY));
}

export async function loadStore(backend: StorageBackend): Promise<InventoryStore> {
  return parseStore(await backend.read(INVENTORY_STORAGE_KEY));
}

export async function saveStore(
  backend: StorageBackend,
  store: InventoryStore,
): Promise<void> {
  await backend.write(INVENTORY_STORAGE_KEY, JSON.stringify(store));
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `inv-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Override matching + application ──────────────────────────────────────

/** Stable match key: category + case-folded, trimmed name. */
export function inventoryKey(category: InventoryCategory, name: string): string {
  return `${category}:${name.trim().toLowerCase()}`;
}

/** Index a stock list by {@link inventoryKey} for O(1) lookup. Last wins. */
export function indexInventory(items: InventoryItem[]): Map<string, InventoryItem> {
  const map = new Map<string, InventoryItem>();
  for (const item of items) {
    map.set(inventoryKey(item.category, item.name), item);
  }
  return map;
}

/** A single field swapped from a recipe/catalog value to a stock value. */
export interface AppliedOverride {
  category: InventoryCategory;
  /** Ingredient display name as it appears in the recipe. */
  name: string;
  /** Which characteristic changed. */
  field: "alpha_acid" | "color" | "yield" | "attenuation";
  /** Value carried by the recipe (null when the recipe didn't specify one). */
  from: number | null;
  /** Value from stock that will be used instead. */
  to: number;
}

const EPS = 1e-9;

function differs(recipeVal: number | undefined, stockVal: number | undefined): stockVal is number {
  if (typeof stockVal !== "number" || !Number.isFinite(stockVal)) return false;
  if (typeof recipeVal !== "number") return true; // recipe didn't specify → stock fills it
  return Math.abs(recipeVal - stockVal) > EPS;
}

/**
 * Return a recipe with stock overrides applied to ingredient
 * characteristics, plus the list of overrides that actually changed
 * something (for the recipe-screen hint). When no override applies the
 * original recipe object is returned unchanged (referentially equal), so
 * callers can cheaply skip recompute.
 *
 * Pure: does not mutate the input recipe.
 */
export function applyInventoryOverrides(
  recipe: BeerJsonRecipe,
  items: InventoryItem[],
): { recipe: BeerJsonRecipe; applied: AppliedOverride[] } {
  if (items.length === 0) return { recipe, applied: [] };
  const index = indexInventory(items);
  if (index.size === 0) return { recipe, applied: [] };

  const applied: AppliedOverride[] = [];

  const fermentables = (recipe.ingredients.fermentable_additions ?? []).map((f) => {
    const stock = index.get(inventoryKey("fermentable", f.name));
    if (!stock) return f;
    let next = f;
    if (differs(f.color?.value, stock.color_ebc)) {
      applied.push({
        category: "fermentable",
        name: f.name,
        field: "color",
        from: f.color?.value ?? null,
        to: stock.color_ebc,
      });
      next = { ...next, color: { value: stock.color_ebc, unit: "EBC" as const } };
    }
    if (differs(f.yield?.fine_grind?.value, stock.yield_pct)) {
      applied.push({
        category: "fermentable",
        name: f.name,
        field: "yield",
        from: f.yield?.fine_grind?.value ?? null,
        to: stock.yield_pct,
      });
      next = {
        ...next,
        yield: { ...next.yield, fine_grind: { value: stock.yield_pct, unit: "%" as const } },
      };
    }
    return next;
  });

  const hops = (recipe.ingredients.hop_additions ?? []).map((h) => {
    const stock = index.get(inventoryKey("hop", h.name));
    if (!stock) return h;
    if (differs(h.alpha_acid?.value, stock.alpha_acid_pct)) {
      applied.push({
        category: "hop",
        name: h.name,
        field: "alpha_acid",
        from: h.alpha_acid?.value ?? null,
        to: stock.alpha_acid_pct,
      });
      return { ...h, alpha_acid: { value: stock.alpha_acid_pct, unit: "%" as const } };
    }
    return h;
  });

  const cultures = (recipe.ingredients.culture_additions ?? []).map((c) => {
    const stock = index.get(inventoryKey("culture", c.name));
    if (!stock) return c;
    if (differs(c.attenuation?.value, stock.attenuation_pct)) {
      applied.push({
        category: "culture",
        name: c.name,
        field: "attenuation",
        from: c.attenuation?.value ?? null,
        to: stock.attenuation_pct,
      });
      return { ...c, attenuation: { value: stock.attenuation_pct, unit: "%" as const } };
    }
    return c;
  });

  if (applied.length === 0) return { recipe, applied: [] };

  return {
    recipe: {
      ...recipe,
      ingredients: {
        ...recipe.ingredients,
        fermentable_additions: fermentables,
        hop_additions: hops,
        culture_additions: cultures,
      },
    },
    applied,
  };
}
