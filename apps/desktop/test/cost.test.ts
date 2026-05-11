import { describe, it, expect } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import { computeRecipeCost, defaultPriceFor } from "../src/data/cost.ts";

// Minimal recipe shape: 20 L batch, 5 kg pale ale malt + 30 g Mosaic
// (boil) + 1 pack US-05 dry yeast.
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

describe("defaultPriceFor", () => {
  it("dispatches base malts to the cheap-malt bucket", () => {
    expect(defaultPriceFor("fermentable", "Pale Ale Malt", { type: "grain" })).toEqual({
      unit_price: 2.2,
      natural_unit: "kg",
    });
    expect(defaultPriceFor("fermentable", "Pilsner Malt", { type: "grain" })).toEqual({
      unit_price: 2.2,
      natural_unit: "kg",
    });
    expect(defaultPriceFor("fermentable", "Maris Otter", { type: "grain" })).toEqual({
      unit_price: 2.2,
      natural_unit: "kg",
    });
  });

  it("dispatches crystal / caramel malts to the mid-tier bucket", () => {
    expect(
      defaultPriceFor("fermentable", "Caramel Munich 60", { type: "grain" }).unit_price,
    ).toBe(3.5);
    expect(defaultPriceFor("fermentable", "Crystal 40", { type: "grain" }).unit_price).toBe(
      3.5,
    );
  });

  it("dispatches roasted malts higher than crystals", () => {
    expect(defaultPriceFor("fermentable", "Roasted Barley", { type: "grain" }).unit_price)
      .toBe(3.8);
    expect(defaultPriceFor("fermentable", "Chocolate Malt", { type: "grain" }).unit_price)
      .toBe(3.8);
  });

  it("treats sugars and extracts as their own bucket", () => {
    expect(
      defaultPriceFor("fermentable", "Honey", { type: "sugar" }).unit_price,
    ).toBe(3);
    expect(
      defaultPriceFor("fermentable", "Light DME", { type: "dry extract" }).unit_price,
    ).toBe(3);
  });

  it("prices premium / proprietary hops higher than standard", () => {
    expect(defaultPriceFor("hop", "Mosaic").unit_price).toBe(0.07);
    expect(defaultPriceFor("hop", "Citra").unit_price).toBe(0.07);
    expect(defaultPriceFor("hop", "Cascade").unit_price).toBe(0.05);
    expect(defaultPriceFor("hop", "Saaz").unit_price).toBe(0.06);
  });

  it("prices liquid yeast ~2× dry yeast", () => {
    expect(defaultPriceFor("culture", "WLP001", { form: "liquid" }).unit_price).toBe(10);
    expect(defaultPriceFor("culture", "US-05", { form: "dry" }).unit_price).toBe(5);
  });

  it("dispatches water salts to the cheap-misc bucket", () => {
    expect(defaultPriceFor("misc", "Gypsum", { type: "water agent" }).unit_price).toBe(
      0.02,
    );
    expect(defaultPriceFor("misc", "Calcium Chloride", { type: "water agent" }).unit_price)
      .toBe(0.02);
  });
});

describe("computeRecipeCost", () => {
  it("returns one line per ingredient with default-priced line cost", () => {
    const breakdown = computeRecipeCost(recipe(), 100);
    expect(breakdown.total_count).toBe(3);
    expect(breakdown.priced_count).toBe(3);
    // 5 kg × €2.20 + 30 g × €0.07 + 1 × €5
    // = 11.00 + 2.10 + 5.00 = €18.10
    expect(breakdown.total).toBeCloseTo(18.1, 2);
  });

  it("applies the inflation coefficient as a uniform multiplier", () => {
    const at100 = computeRecipeCost(recipe(), 100);
    const at120 = computeRecipeCost(recipe(), 120);
    const at50 = computeRecipeCost(recipe(), 50);
    expect(at120.total).toBeCloseTo(at100.total * 1.2, 4);
    expect(at50.total).toBeCloseTo(at100.total * 0.5, 4);
  });

  it("100% inflation is a no-op", () => {
    const breakdown = computeRecipeCost(recipe(), 100);
    // Mosaic: 30 g × €0.07 = €2.10 exactly.
    const hop = breakdown.lines.find((l) => l.category === "hop")!;
    expect(hop.line_cost).toBeCloseTo(2.1, 4);
  });

  it("derives per-liter and per-330mL-bottle from total and batch size", () => {
    const breakdown = computeRecipeCost(recipe(), 100);
    expect(breakdown.batch_l).toBe(20);
    expect(breakdown.per_liter).toBeCloseTo(breakdown.total / 20, 3);
    expect(breakdown.per_bottle_330).toBeCloseTo(
      (breakdown.total * 0.33) / 20,
      3,
    );
  });

  it("exposes the default unit price + natural unit on each line", () => {
    const breakdown = computeRecipeCost(recipe(), 100);
    const grain = breakdown.lines.find((l) => l.category === "fermentable")!;
    expect(grain.default_unit_price).toBe(2.2);
    expect(grain.natural_unit).toBe("kg");
    expect(grain.amount_in_natural_unit).toBe(5);
  });

  it("returns 0 total when the recipe has no ingredients", () => {
    const empty: BeerJsonRecipe = {
      ...recipe(),
      ingredients: { fermentable_additions: [] },
    };
    const breakdown = computeRecipeCost(empty, 100);
    expect(breakdown.total_count).toBe(0);
    expect(breakdown.total).toBe(0);
  });
});
