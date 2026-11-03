import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { recipeTargets, shownValue } from "../src/data/recipe-targets.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const load = (file: string): BeerJsonRecipe =>
  (JSON.parse(readFileSync(join(__dirname, "../../../examples", file), "utf8")) as BeerJsonFile)
    .beerjson.recipes![0]!;

// Punk IPA ships OG and FG but no ABV, IBU or color.
const punk = load("brewdog-punk-ipa-2007.beerjson");
const cascade = load("cascade-pale-ale.beerjson");

describe("recipeTargets", () => {
  it("estimates ABV from the file's OG and FG when the file has none", () => {
    const t = recipeTargets(punk, "Morey");
    expect(t.abv.claimed).toBeNull();
    // (1.056 − 1.010) × 131.25 ≈ 6.0 %
    expect(shownValue(t.abv)).toBeCloseTo(6.0, 1);
  });

  it("estimates the color from the grain bill when the file has none", () => {
    const t = recipeTargets(punk, "Morey");
    expect(t.srm.claimed).toBeNull();
    expect(shownValue(t.srm)).toBeGreaterThan(0);
  });

  it("shows the file's values first", () => {
    const t = recipeTargets(cascade, "Morey");
    expect(shownValue(t.og)).toBe(cascade.original_gravity!.value);
    expect(shownValue(t.fg)).toBe(cascade.final_gravity!.value);
    expect(shownValue(t.abv)).toBe(cascade.alcohol_by_volume!.value);
    expect(t.og.computed).toBeGreaterThan(1);
  });

  it("estimates OG and FG from the ingredients when the file has none", () => {
    const { original_gravity: _og, final_gravity: _fg, alcohol_by_volume: _abv, ...bare } = cascade;
    const t = recipeTargets(bare, "Morey");
    expect(shownValue(t.og)).toBeGreaterThan(1.03);
    expect(shownValue(t.fg)!).toBeLessThan(shownValue(t.og)!);
    expect(shownValue(t.abv)).toBeGreaterThan(3);
  });

  it("no estimate without fermentables", () => {
    const empty: BeerJsonRecipe = {
      ...cascade,
      original_gravity: undefined,
      final_gravity: undefined,
      alcohol_by_volume: undefined,
      color_estimate: undefined,
      ingredients: { ...cascade.ingredients, fermentable_additions: [] },
    } as unknown as BeerJsonRecipe;
    const t = recipeTargets(empty, "Morey");
    expect(shownValue(t.og)).toBeNull();
    expect(shownValue(t.fg)).toBeNull();
    expect(shownValue(t.abv)).toBeNull();
    expect(shownValue(t.srm)).toBeNull();
  });
});
