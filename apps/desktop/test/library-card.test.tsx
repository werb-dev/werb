import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { RecipeCard } from "../src/screens/Library.tsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const load = (file: string): BeerJsonRecipe =>
  (JSON.parse(readFileSync(join(__dirname, "../../../examples", file), "utf8")) as BeerJsonFile)
    .beerjson.recipes![0]!;

const noop = () => {};
const card = (recipe: BeerJsonRecipe) =>
  render(<RecipeCard recipe={recipe} onSelect={noop} onDuplicate={noop} onDelete={noop} />);
const stat = (id: string) => screen.getByTestId(id).querySelector("dd")!.textContent ?? "";

describe("RecipeCard", () => {
  afterEach(cleanup);

  it("fills ABV, IBU and color from Werb's estimates when the file lacks them (#49)", () => {
    card(load("brewdog-punk-ipa-2007.beerjson"));
    expect(stat("card-stat-og")).toBe("1.056");
    expect(stat("card-stat-fg")).toBe("1.010");
    expect(stat("card-stat-abv")).toMatch(/^\d+\.\d%$/);
    expect(stat("card-stat-ibu")).toMatch(/^\d+$/);
    expect(screen.getByTestId("card-color")).toBeTruthy();
  });

  it("shows the file's values, with Werb's IBU estimate alongside", () => {
    const recipe = load("cascade-pale-ale.beerjson");
    card(recipe);
    expect(stat("card-stat-abv")).toBe(`${recipe.alcohol_by_volume!.value.toFixed(1)}%`);
    expect(stat("card-stat-ibu")).toMatch(new RegExp(`^${recipe.ibu_estimate!.ibu!.value}≈\\d+$`));
  });

  it("shows dashes when there is nothing to estimate from", () => {
    const empty = {
      ...load("cascade-pale-ale.beerjson"),
      original_gravity: undefined,
      final_gravity: undefined,
      alcohol_by_volume: undefined,
      ibu_estimate: undefined,
      color_estimate: undefined,
      ingredients: { fermentable_additions: [] },
    } as unknown as BeerJsonRecipe;
    card(empty);
    expect(stat("card-stat-og")).toBe("—");
    expect(stat("card-stat-abv")).toBe("—");
    expect(screen.queryByTestId("card-color")).toBeNull();
  });
});
