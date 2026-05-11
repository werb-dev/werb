import { describe, it, expect } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import { collectLibraryIngredients, computeRecipeCost } from "../src/data/cost.ts";
import { EMPTY_CATALOG, upsertPrice } from "../src/data/prices.ts";

// Minimal recipe shape: 20 L batch, 5 kg pale ale malt + 30 g Mosaic
// (boil) + 1 pack US-05. Cost-relevant fields only — everything else
// matches the BeerJsonRecipe contract via casts.
function recipe(): BeerJsonRecipe {
  return {
    name: "Test pale",
    type: "all grain",
    author: "",
    batch_size: { value: 20, unit: "l" },
    efficiency: { brewhouse: { value: 75, unit: "%" } },
    ingredients: {
      fermentable_additions: [
        {
          name: "Pale Ale Malt",
          type: "grain",
          amount: { value: 5, unit: "kg" },
        },
      ],
      hop_additions: [
        {
          name: "Mosaic",
          alpha_acid: { value: 12, unit: "%" },
          amount: { value: 0.03, unit: "kg" },
          form: "pellet",
          timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
        },
      ],
      culture_additions: [
        {
          name: "US-05",
          type: "ale",
          form: "dry",
          amount: { value: 1, unit: "pkg" },
        },
      ],
    },
  };
}

describe("computeRecipeCost", () => {
  it("returns one line per priced + unpriced ingredient", () => {
    const breakdown = computeRecipeCost(recipe(), EMPTY_CATALOG);
    expect(breakdown.total_count).toBe(3);
    expect(breakdown.priced_count).toBe(0);
    expect(breakdown.total).toBe(0);
    expect(breakdown.lines.every((l) => l.price === null)).toBe(true);
  });

  it("prices a fermentable in kg → kg, multiplies through", () => {
    let cat = upsertPrice(EMPTY_CATALOG, "Pale Ale Malt", 2.5, "kg");
    const breakdown = computeRecipeCost(recipe(), cat);
    const grain = breakdown.lines.find((l) => l.category === "fermentable")!;
    // 5 kg × €2.50 = €12.50
    expect(grain.line_cost).toBeCloseTo(12.5, 2);
    expect(breakdown.total).toBeCloseTo(12.5, 2);
    expect(breakdown.priced_count).toBe(1);
  });

  it("prices a hop in g when catalog stores €/g", () => {
    const cat = upsertPrice(EMPTY_CATALOG, "Mosaic", 0.04, "g");
    const breakdown = computeRecipeCost(recipe(), cat);
    const hop = breakdown.lines.find((l) => l.category === "hop")!;
    // 0.03 kg = 30 g. 30 × €0.04 = €1.20
    expect(hop.line_cost).toBeCloseTo(1.2, 2);
  });

  it("prices a hop in kg when catalog stores €/kg (conversion the other way)", () => {
    const cat = upsertPrice(EMPTY_CATALOG, "Mosaic", 40, "kg");
    const breakdown = computeRecipeCost(recipe(), cat);
    const hop = breakdown.lines.find((l) => l.category === "hop")!;
    // 0.03 kg × €40 = €1.20 (same cost, different price basis)
    expect(hop.line_cost).toBeCloseTo(1.2, 2);
  });

  it("prices yeast in packs when amount.unit is pkg", () => {
    const cat = upsertPrice(EMPTY_CATALOG, "US-05", 3.5, "pack");
    const breakdown = computeRecipeCost(recipe(), cat);
    const yeast = breakdown.lines.find((l) => l.category === "culture")!;
    expect(yeast.line_cost).toBeCloseTo(3.5, 2);
  });

  it("sums every priced line into the batch total", () => {
    let cat = upsertPrice(EMPTY_CATALOG, "Pale Ale Malt", 2.5, "kg");
    cat = upsertPrice(cat, "Mosaic", 0.04, "g");
    cat = upsertPrice(cat, "US-05", 3.5, "pack");
    const breakdown = computeRecipeCost(recipe(), cat);
    // 12.50 + 1.20 + 3.50 = 17.20
    expect(breakdown.total).toBeCloseTo(17.2, 2);
    expect(breakdown.priced_count).toBe(3);
  });

  it("derives per-liter and per-330mL-bottle from total and batch size", () => {
    let cat = upsertPrice(EMPTY_CATALOG, "Pale Ale Malt", 2.5, "kg");
    cat = upsertPrice(cat, "Mosaic", 0.04, "g");
    cat = upsertPrice(cat, "US-05", 3.5, "pack");
    const breakdown = computeRecipeCost(recipe(), cat);
    expect(breakdown.batch_l).toBe(20);
    expect(breakdown.per_liter).toBeCloseTo(17.2 / 20, 3);
    expect(breakdown.per_bottle_330).toBeCloseTo((17.2 * 0.33) / 20, 3);
  });

  it("matches catalog entries case-insensitively", () => {
    const cat = upsertPrice(EMPTY_CATALOG, "pale ale malt", 2.5, "kg");
    const breakdown = computeRecipeCost(recipe(), cat);
    expect(breakdown.lines.find((l) => l.category === "fermentable")?.line_cost).toBeCloseTo(
      12.5,
      2,
    );
  });

  it("leaves a line unpriced when conversion isn't possible (e.g. hop priced per pack)", () => {
    const cat = upsertPrice(EMPTY_CATALOG, "Mosaic", 5, "pack");
    const breakdown = computeRecipeCost(recipe(), cat);
    const hop = breakdown.lines.find((l) => l.category === "hop")!;
    // We don't know "how many packs is 30 g" — leave unpriced rather
    // than guess.
    expect(hop.line_cost).toBeNull();
  });
});

describe("collectLibraryIngredients", () => {
  it("returns empty when there are no recipes", () => {
    expect(collectLibraryIngredients([])).toEqual([]);
  });

  it("de-duplicates ingredient names across recipes (case-insensitive)", () => {
    const r1 = recipe(); // Mosaic, Pale Ale Malt, US-05
    const r2: BeerJsonRecipe = {
      ...recipe(),
      ingredients: {
        fermentable_additions: [
          { name: "PALE ALE MALT", type: "grain", amount: { value: 4, unit: "kg" } },
        ],
        hop_additions: [
          {
            name: "mosaic",
            alpha_acid: { value: 12, unit: "%" },
            amount: { value: 0.05, unit: "kg" },
            form: "pellet",
            timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
          },
        ],
      },
    };
    const out = collectLibraryIngredients([r1, r2]);
    // Three distinct ingredients regardless of capitalization.
    expect(out.map((i) => i.key).sort()).toEqual([
      "mosaic",
      "pale ale malt",
      "us-05",
    ]);
  });

  it("counts recipes per ingredient and sorts most-used first", () => {
    const r1 = recipe();
    const r2: BeerJsonRecipe = {
      ...recipe(),
      ingredients: {
        fermentable_additions: [
          { name: "Pale Ale Malt", type: "grain", amount: { value: 5, unit: "kg" } },
        ],
        hop_additions: [],
      },
    };
    const r3: BeerJsonRecipe = {
      ...recipe(),
      ingredients: {
        fermentable_additions: [
          { name: "Pale Ale Malt", type: "grain", amount: { value: 5, unit: "kg" } },
          { name: "Munich Malt", type: "grain", amount: { value: 1, unit: "kg" } },
        ],
        hop_additions: [],
      },
    };
    const out = collectLibraryIngredients([r1, r2, r3]);
    const pale = out.find((i) => i.key === "pale ale malt")!;
    const munich = out.find((i) => i.key === "munich malt")!;
    expect(pale.recipe_count).toBe(3);
    expect(munich.recipe_count).toBe(1);
    // Sort: pale ale malt (3) before munich (1).
    expect(out.findIndex((i) => i.key === "pale ale malt")).toBeLessThan(
      out.findIndex((i) => i.key === "munich malt"),
    );
  });

  it("doesn't double-count an ingredient appearing twice in the same recipe", () => {
    const r: BeerJsonRecipe = {
      ...recipe(),
      ingredients: {
        fermentable_additions: [],
        hop_additions: [
          // Mosaic at 60 min AND 0 min — same hop, two additions.
          {
            name: "Mosaic",
            alpha_acid: { value: 12, unit: "%" },
            amount: { value: 0.03, unit: "kg" },
            form: "pellet",
            timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
          },
          {
            name: "Mosaic",
            alpha_acid: { value: 12, unit: "%" },
            amount: { value: 0.05, unit: "kg" },
            form: "pellet",
            timing: { use: "add_to_boil", time: { value: 0, unit: "min" } },
          },
        ],
      },
    };
    const out = collectLibraryIngredients([r]);
    const mosaic = out.find((i) => i.key === "mosaic")!;
    expect(mosaic.recipe_count).toBe(1);
  });

  it("preserves the first capitalization encountered as the display name", () => {
    const r1: BeerJsonRecipe = {
      ...recipe(),
      ingredients: {
        fermentable_additions: [],
        hop_additions: [
          {
            name: "Mosaic",
            alpha_acid: { value: 12, unit: "%" },
            amount: { value: 0.03, unit: "kg" },
            form: "pellet",
            timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
          },
        ],
      },
    };
    const r2: BeerJsonRecipe = {
      ...recipe(),
      ingredients: {
        fermentable_additions: [],
        hop_additions: [
          {
            name: "MOSAIC",
            alpha_acid: { value: 12, unit: "%" },
            amount: { value: 0.05, unit: "kg" },
            form: "pellet",
            timing: { use: "add_to_boil", time: { value: 0, unit: "min" } },
          },
        ],
      },
    };
    const out = collectLibraryIngredients([r1, r2]);
    expect(out[0]!.display_name).toBe("Mosaic");
  });
});
