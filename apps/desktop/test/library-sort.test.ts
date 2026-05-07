import { describe, it, expect } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import { filterAndSort } from "../src/data/library-sort.ts";
import type { StoredRecipe } from "../src/data/recipes.ts";

function stored(
  name: string,
  opts: {
    style?: string;
    category?: string;
    author?: string;
    updatedAt?: string;
  } = {},
): StoredRecipe {
  const recipe: BeerJsonRecipe = {
    name,
    type: "all grain",
    author: opts.author ?? "Test",
    batch_size: { value: 20, unit: "l" },
    efficiency: { brewhouse: { value: 75, unit: "%" } },
    ingredients: { fermentable_additions: [] },
    ...(opts.style && {
      style: { name: opts.style, ...(opts.category && { category: opts.category }) },
    }),
  };
  return {
    id: `id-${name}`,
    recipe,
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: opts.updatedAt ?? "2026-05-01T00:00:00Z",
  };
}

describe("filterAndSort — search", () => {
  const recipes = [
    stored("Cascade IPA", { style: "American IPA", author: "Alice" }),
    stored("Belgian Tripel", { style: "Belgian Tripel", category: "Strong Belgian Ale" }),
    stored("Munich Dunkel", { style: "Munich Dunkel", author: "Bob" }),
  ];

  it("returns everything when query is empty", () => {
    expect(filterAndSort(recipes, "", "name")).toHaveLength(3);
  });

  it("matches by recipe name (substring, case-insensitive)", () => {
    expect(filterAndSort(recipes, "cascade", "name")).toHaveLength(1);
    expect(filterAndSort(recipes, "MUNICH", "name")).toHaveLength(1);
  });

  it("matches by style name", () => {
    expect(filterAndSort(recipes, "tripel", "name")).toHaveLength(1);
  });

  it("matches by style category", () => {
    expect(filterAndSort(recipes, "strong belgian", "name")).toHaveLength(1);
  });

  it("matches by author", () => {
    expect(filterAndSort(recipes, "alice", "name")).toHaveLength(1);
  });

  it("returns empty when nothing matches", () => {
    expect(filterAndSort(recipes, "xyz", "name")).toHaveLength(0);
  });

  it("trims the query before matching", () => {
    expect(filterAndSort(recipes, "  ipa  ", "name")).toHaveLength(1);
  });
});

describe("filterAndSort — sort", () => {
  it("name sort is alphabetical A→Z", () => {
    const out = filterAndSort(
      [stored("Charlie"), stored("Alpha"), stored("Bravo")],
      "",
      "name",
    );
    expect(out.map((r) => r.recipe.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("style sort is alphabetical, missing style sorts first (empty string)", () => {
    const out = filterAndSort(
      [
        stored("Two", { style: "Stout" }),
        stored("Three", { style: "IPA" }),
        stored("One"),
      ],
      "",
      "style",
    );
    expect(out.map((r) => r.recipe.name)).toEqual(["One", "Three", "Two"]);
  });

  it("updated sort is most-recent first", () => {
    const out = filterAndSort(
      [
        stored("Old", { updatedAt: "2026-01-01T00:00:00Z" }),
        stored("New", { updatedAt: "2026-05-01T00:00:00Z" }),
        stored("Mid", { updatedAt: "2026-03-01T00:00:00Z" }),
      ],
      "",
      "updated",
    );
    expect(out.map((r) => r.recipe.name)).toEqual(["New", "Mid", "Old"]);
  });

  it("does not mutate the input array", () => {
    const input = [stored("Z"), stored("A")];
    const before = input.map((r) => r.recipe.name).join(",");
    filterAndSort(input, "", "name");
    const after = input.map((r) => r.recipe.name).join(",");
    expect(before).toBe(after);
  });
});
