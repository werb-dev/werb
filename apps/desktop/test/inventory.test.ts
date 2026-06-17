import { describe, it, expect } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import { MemoryBackend } from "../src/storage/index.ts";
import {
  applyInventoryOverrides,
  checkRecipeStock,
  indexInventory,
  inventoryKey,
  loadStore,
  saveStore,
  INVENTORY_STORAGE_KEY,
  type InventoryItem,
} from "../src/data/inventory.ts";

function recipe(overrides: Partial<BeerJsonRecipe["ingredients"]> = {}): BeerJsonRecipe {
  return {
    name: "Test IPA",
    type: "all grain",
    batch_size: { value: 20, unit: "l" },
    ingredients: {
      fermentable_additions: [
        {
          name: "Pale 2-Row",
          type: "grain",
          amount: { value: 4.5, unit: "kg" },
          yield: { fine_grind: { value: 80, unit: "%" } },
          color: { value: 4, unit: "EBC" },
        },
      ],
      hop_additions: [
        {
          name: "Cascade",
          alpha_acid: { value: 5.5, unit: "%" },
          amount: { value: 0.028, unit: "kg" },
          form: "pellet",
          timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
        },
      ],
      culture_additions: [
        { name: "US-05", type: "ale", form: "dry", attenuation: { value: 78, unit: "%" } },
      ],
      ...overrides,
    },
  } as unknown as BeerJsonRecipe;
}

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "category" | "name">): InventoryItem {
  return { id: `id-${partial.name}`, ...partial };
}

describe("inventoryKey / indexInventory", () => {
  it("folds case and trims for the match key", () => {
    expect(inventoryKey("hop", "  Cascade  ")).toBe("hop:cascade");
  });

  it("indexes by key, last entry winning on collision", () => {
    const idx = indexInventory([
      item({ category: "hop", name: "Cascade", alpha_acid_pct: 6 }),
      item({ category: "hop", name: "cascade", alpha_acid_pct: 7 }),
    ]);
    expect(idx.size).toBe(1);
    expect(idx.get("hop:cascade")?.alpha_acid_pct).toBe(7);
  });
});

describe("applyInventoryOverrides", () => {
  it("returns the same recipe reference and no overrides when stock is empty", () => {
    const r = recipe();
    const out = applyInventoryOverrides(r, []);
    expect(out.recipe).toBe(r);
    expect(out.applied).toEqual([]);
  });

  it("overrides hop alpha and records from→to", () => {
    const out = applyInventoryOverrides(recipe(), [
      item({ category: "hop", name: "Cascade", alpha_acid_pct: 7.2 }),
    ]);
    expect(out.recipe.ingredients.hop_additions![0].alpha_acid).toEqual({ value: 7.2, unit: "%" });
    expect(out.applied).toContainEqual({
      category: "hop",
      name: "Cascade",
      field: "alpha_acid",
      from: 5.5,
      to: 7.2,
    });
  });

  it("overrides fermentable color and yield", () => {
    const out = applyInventoryOverrides(recipe(), [
      item({ category: "fermentable", name: "Pale 2-Row", color_ebc: 6, yield_pct: 82 }),
    ]);
    const f = out.recipe.ingredients.fermentable_additions[0];
    expect(f.color).toEqual({ value: 6, unit: "EBC" });
    expect(f.yield?.fine_grind).toEqual({ value: 82, unit: "%" });
    expect(out.applied.map((a) => a.field).sort()).toEqual(["color", "yield"]);
  });

  it("overrides culture attenuation", () => {
    const out = applyInventoryOverrides(recipe(), [
      item({ category: "culture", name: "US-05", attenuation_pct: 81 }),
    ]);
    expect(out.recipe.ingredients.culture_additions![0].attenuation).toEqual({
      value: 81,
      unit: "%",
    });
  });

  it("matches case-insensitively and trims", () => {
    const out = applyInventoryOverrides(recipe(), [
      item({ category: "hop", name: "  cascade ", alpha_acid_pct: 8 }),
    ]);
    expect(out.applied).toHaveLength(1);
    expect(out.recipe.ingredients.hop_additions![0].alpha_acid?.value).toBe(8);
  });

  it("is a no-op when the stock value equals the recipe value", () => {
    const r = recipe();
    const out = applyInventoryOverrides(r, [
      item({ category: "hop", name: "Cascade", alpha_acid_pct: 5.5 }),
    ]);
    expect(out.recipe).toBe(r);
    expect(out.applied).toEqual([]);
  });

  it("fills a value the recipe omitted (from = null)", () => {
    const r = recipe({
      hop_additions: [
        {
          name: "Mystery",
          amount: { value: 0.02, unit: "kg" },
          timing: { use: "add_to_boil", time: { value: 10, unit: "min" } },
        },
      ],
    } as Partial<BeerJsonRecipe["ingredients"]>);
    const out = applyInventoryOverrides(r, [
      item({ category: "hop", name: "Mystery", alpha_acid_pct: 12 }),
    ]);
    expect(out.applied[0]).toMatchObject({ from: null, to: 12 });
  });

  it("ignores stock items whose name doesn't match any ingredient", () => {
    const r = recipe();
    const out = applyInventoryOverrides(r, [
      item({ category: "hop", name: "Citra", alpha_acid_pct: 12 }),
    ]);
    expect(out.recipe).toBe(r);
    expect(out.applied).toEqual([]);
  });

  it("does not mutate the input recipe", () => {
    const r = recipe();
    applyInventoryOverrides(r, [item({ category: "hop", name: "Cascade", alpha_acid_pct: 9 })]);
    expect(r.ingredients.hop_additions![0].alpha_acid?.value).toBe(5.5);
  });
});

describe("checkRecipeStock (short-on-stock)", () => {
  it("flags a hop you don't have enough of, summing across additions", () => {
    // Recipe needs 28 g Cascade; add a second 28 g addition → 56 g total.
    const r = recipe({
      hop_additions: [
        {
          name: "Cascade",
          alpha_acid: { value: 5.5, unit: "%" },
          amount: { value: 0.028, unit: "kg" },
          timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
        },
        {
          name: "Cascade",
          alpha_acid: { value: 5.5, unit: "%" },
          amount: { value: 0.028, unit: "kg" },
          timing: { use: "add_to_fermentation", time: { value: 3, unit: "day" } },
        },
      ],
    } as Partial<BeerJsonRecipe["ingredients"]>);
    const out = checkRecipeStock(r, [
      item({ category: "hop", name: "Cascade", quantity: 50, quantity_unit: "g" }),
    ]);
    expect(out).toEqual([
      { category: "hop", name: "Cascade", needed_g: 56, on_hand_g: 50 },
    ]);
  });

  it("does not flag when there's enough on hand", () => {
    const out = checkRecipeStock(recipe(), [
      item({ category: "hop", name: "Cascade", quantity: 100, quantity_unit: "g" }),
    ]);
    expect(out).toEqual([]);
  });

  it("converts kg on-hand before comparing", () => {
    // Recipe needs 4.5 kg Pale 2-Row; only 1 kg on hand.
    const out = checkRecipeStock(recipe(), [
      item({ category: "fermentable", name: "Pale 2-Row", quantity: 1, quantity_unit: "kg" }),
    ]);
    expect(out).toEqual([
      { category: "fermentable", name: "Pale 2-Row", needed_g: 4500, on_hand_g: 1000 },
    ]);
  });

  it("ignores stock tracked in a non-mass unit (packs / ml)", () => {
    const out = checkRecipeStock(recipe(), [
      item({ category: "hop", name: "Cascade", quantity: 1, quantity_unit: "pkg" }),
    ]);
    expect(out).toEqual([]);
  });

  it("ignores ingredients not in the stock list (no nagging about untracked items)", () => {
    const out = checkRecipeStock(recipe(), [
      item({ category: "hop", name: "Citra", quantity: 1, quantity_unit: "g" }),
    ]);
    expect(out).toEqual([]);
  });

  it("returns nothing when the brewer has no inventory", () => {
    expect(checkRecipeStock(recipe(), [])).toEqual([]);
  });
});

describe("inventory store", () => {
  it("round-trips items through a backend", async () => {
    const backend = new MemoryBackend();
    const items = [item({ category: "hop", name: "Cascade", alpha_acid_pct: 7 })];
    await saveStore(backend, { items });
    const loaded = await loadStore(backend);
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0].name).toBe("Cascade");
  });

  it("returns empty for absent or malformed data, dropping non-items", async () => {
    expect((await loadStore(new MemoryBackend())).items).toEqual([]);

    const bad = new MemoryBackend({ [INVENTORY_STORAGE_KEY]: "not json" });
    expect((await loadStore(bad)).items).toEqual([]);

    const mixed = new MemoryBackend({
      [INVENTORY_STORAGE_KEY]: JSON.stringify({
        items: [
          { id: "1", category: "hop", name: "Cascade" },
          { id: "2", category: "bogus", name: "X" }, // bad category
          { name: "no id" }, // missing fields
          42,
        ],
      }),
    });
    const loaded = await loadStore(mixed);
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0].name).toBe("Cascade");
  });
});
