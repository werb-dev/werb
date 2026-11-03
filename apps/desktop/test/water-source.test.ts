import { describe, expect, it } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import {
  recipeSourceIons,
  sourceSelection,
} from "../src/screens/Recipe/WaterChemistrySection.tsx";
import { analysisToIons, isUnsetWater, ZERO_IONS } from "../src/data/home-water.ts";

function recipeWith(waterAdditions: unknown[]): BeerJsonRecipe {
  return {
    name: "Test",
    type: "all grain",
    batch_size: { value: 20, unit: "l" },
    ingredients: {
      fermentable_additions: [],
      water_additions: waterAdditions,
    },
  } as unknown as BeerJsonRecipe;
}

describe("recipeSourceIons", () => {
  it("extracts the six ions from a BeerJSON WaterBase", () => {
    const ions = recipeSourceIons(
      recipeWith([
        {
          name: "Tap",
          calcium: { value: 54.5, unit: "mg/l" },
          magnesium: { value: 5.75, unit: "mg/l" },
          sodium: { value: 5.9, unit: "mg/l" },
          chloride: { value: 10.1, unit: "mg/l" },
          sulfate: { value: 12.8, unit: "mg/l" },
          bicarbonate: { value: 183, unit: "mg/l" },
        },
      ]),
    );
    expect(ions).toEqual({
      ca_ppm: 54.5,
      mg_ppm: 5.75,
      na_ppm: 5.9,
      cl_ppm: 10.1,
      so4_ppm: 12.8,
      hco3_ppm: 183,
    });
  });

  it("defaults missing ions to 0 but still returns a profile", () => {
    const ions = recipeSourceIons(
      recipeWith([{ calcium: { value: 40, unit: "mg/l" } }]),
    );
    expect(ions).toMatchObject({ ca_ppm: 40, mg_ppm: 0, hco3_ppm: 0 });
  });

  it("returns null when the recipe carries no water additions", () => {
    expect(recipeSourceIons(recipeWith([]))).toBeNull();
    expect(
      recipeSourceIons({
        name: "x",
        type: "all grain",
        batch_size: { value: 20, unit: "l" },
        ingredients: { fermentable_additions: [] },
      } as unknown as BeerJsonRecipe),
    ).toBeNull();
  });

  it("returns null when every ion is zero (no usable profile)", () => {
    const ions = recipeSourceIons(
      recipeWith([{ calcium: { value: 0 }, sulfate: { value: 0 } }]),
    );
    expect(ions).toBeNull();
  });
});

describe("analysisToIons", () => {
  it("maps a moneaudebrassage network to the ion profile shape", () => {
    expect(
      analysisToIons({
        network: "X",
        ca_ppm: 54.5,
        mg_ppm: 5.75,
        na_ppm: 5.9,
        cl_ppm: 10.1,
        so4_ppm: 12.8,
        hco3_ppm: 183,
      }),
    ).toEqual({
      ca_ppm: 54.5,
      mg_ppm: 5.75,
      na_ppm: 5.9,
      cl_ppm: 10.1,
      so4_ppm: 12.8,
      hco3_ppm: 183,
    });
  });
});

describe("sourceSelection", () => {
  const home = { ca_ppm: 42, mg_ppm: 8, na_ppm: 10, cl_ppm: 20, so4_ppm: 30, hco3_ppm: 150 };
  const fromRecipe = { ca_ppm: 60, mg_ppm: 5, na_ppm: 5, cl_ppm: 40, so4_ppm: 50, hco3_ppm: 100 };

  it("picks My water when the source matches it", () => {
    expect(sourceSelection(home, home, fromRecipe)).toBe("home");
  });

  it("picks the recipe's water when the source matches it", () => {
    expect(sourceSelection(fromRecipe, home, fromRecipe)).toBe("recipe");
  });

  it("never matches an unset (all-zero) My water", () => {
    expect(isUnsetWater(ZERO_IONS)).toBe(true);
    expect(sourceSelection(ZERO_IONS, ZERO_IONS, null)).not.toBe("home");
  });

  it("falls back to custom for edited ions", () => {
    expect(sourceSelection({ ...home, ca_ppm: 43 }, home, fromRecipe)).toBe("");
  });
});
