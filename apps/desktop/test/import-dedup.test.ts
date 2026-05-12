import { describe, it, expect } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import { partitionForImport, skippedSummary } from "../src/data/import-dedup.ts";
import type { StoredRecipe } from "../src/data/recipes.ts";

function recipe(name: string): BeerJsonRecipe {
  return {
    name,
    type: "all grain",
    author: "Test",
    batch_size: { value: 20, unit: "l" },
    efficiency: { brewhouse: { value: 75, unit: "%" } },
    ingredients: { fermentable_additions: [] },
  };
}

function stored(name: string, id = `id-${name}`): StoredRecipe {
  return {
    id,
    recipe: recipe(name),
    createdAt: "2026-05-07T00:00:00Z",
    updatedAt: "2026-05-07T00:00:00Z",
  };
}

describe("partitionForImport", () => {
  it("returns empty when nothing is incoming", () => {
    const out = partitionForImport([], [stored("Existing")]);
    expect(out.fresh).toEqual([]);
    expect(out.skipped).toEqual([]);
  });

  it("treats every incoming as fresh when the library is empty", () => {
    const incoming = [recipe("A"), recipe("B")];
    const out = partitionForImport(incoming, []);
    expect(out.fresh).toHaveLength(2);
    expect(out.skipped).toHaveLength(0);
  });

  it("skips incoming whose name matches an existing recipe", () => {
    const out = partitionForImport(
      [recipe("Cascade IPA"), recipe("Saison")],
      [stored("Cascade IPA")],
    );
    expect(out.fresh.map((r) => r.name)).toEqual(["Saison"]);
    expect(out.skipped.map((r) => r.name)).toEqual(["Cascade IPA"]);
  });

  it("matches case-insensitively + after trimming whitespace", () => {
    const out = partitionForImport(
      [recipe("  cascade ipa  ")],
      [stored("Cascade IPA")],
    );
    expect(out.fresh).toHaveLength(0);
    expect(out.skipped).toHaveLength(1);
  });

  it("does not deduplicate within the incoming batch itself", () => {
    // Two incoming with identical name: both pass through as fresh
    // when the library is empty. (Same-batch dedup is a separate
    // concern; this function only guards the existing library.)
    const out = partitionForImport([recipe("Twin"), recipe("Twin")], []);
    expect(out.fresh).toHaveLength(2);
  });

  it("preserves incoming order in the fresh array", () => {
    const out = partitionForImport(
      [recipe("A"), recipe("B"), recipe("C")],
      [stored("B")],
    );
    expect(out.fresh.map((r) => r.name)).toEqual(["A", "C"]);
    expect(out.skipped.map((r) => r.name)).toEqual(["B"]);
  });
});

describe("skippedSummary", () => {
  it("returns null when nothing was skipped", () => {
    expect(skippedSummary([])).toBeNull();
  });

  it("count + quoted name for one skipped recipe", () => {
    const sum = skippedSummary([recipe("Foo")])!;
    expect(sum.count).toBe(1);
    expect(sum.names).toBe('"Foo"');
  });

  it("count + comma-joined names for multiple", () => {
    const sum = skippedSummary([recipe("Foo"), recipe("Bar")])!;
    expect(sum.count).toBe(2);
    expect(sum.names).toContain('"Foo"');
    expect(sum.names).toContain('"Bar"');
  });
});
