import { describe, expect, it } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import {
  analysisToIons,
  recipeSourceIons,
} from "../src/screens/Recipe/WaterChemistrySection.tsx";

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
