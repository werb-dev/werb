import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { parseBeerJsonText } from "../src/data/recipes.ts";
import { recipeToBeerXml } from "../src/data/recipe-export.ts";

/**
 * Round-trip integration tests: a recipe should survive a serialize → parse
 * cycle without losing or corrupting its meaningful fields. These guard the
 * import/export boundaries against schema drift, since both sides are
 * driven by separate code paths (validate + parse on import; manual
 * builders on export).
 *
 * The bundled examples/double-ipa-mandarina.beerjson is also the fixture
 * used by adapter unit tests, giving us cross-coverage between layers.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "../../../examples/double-ipa-mandarina.beerjson");
const FIXTURE_RAW = readFileSync(FIXTURE_PATH, "utf8");
const FIXTURE = JSON.parse(FIXTURE_RAW) as BeerJsonFile;
const RECIPE: BeerJsonRecipe = FIXTURE.beerjson.recipes![0]!;

function rebuildFile(recipe: BeerJsonRecipe): string {
  return JSON.stringify({
    beerjson: { version: 2.06, recipes: [recipe] },
  });
}

describe("BeerJSON round-trip", () => {
  it("the bundled fixture parses cleanly", () => {
    const result = parseBeerJsonText(FIXTURE_RAW);
    expect(result.error).toBeUndefined();
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]!.name).toBe(RECIPE.name);
  });

  it("a recipe → JSON → parse cycle preserves identity-shaping fields", () => {
    const text = rebuildFile(RECIPE);
    const result = parseBeerJsonText(text);
    expect(result.error).toBeUndefined();

    const r = result.recipes[0]!;
    expect(r.name).toBe(RECIPE.name);
    expect(r.type).toBe(RECIPE.type);
    expect(r.author).toBe(RECIPE.author);
    expect(r.batch_size).toEqual(RECIPE.batch_size);
    expect(r.efficiency).toEqual(RECIPE.efficiency);
  });

  it("ingredient lists round-trip with counts and amounts intact", () => {
    const text = rebuildFile(RECIPE);
    const r = parseBeerJsonText(text).recipes[0]!;

    expect(r.ingredients.fermentable_additions).toHaveLength(
      RECIPE.ingredients.fermentable_additions.length,
    );
    expect(r.ingredients.hop_additions?.length).toBe(
      RECIPE.ingredients.hop_additions?.length,
    );
    expect(r.ingredients.culture_additions?.length).toBe(
      RECIPE.ingredients.culture_additions?.length,
    );

    // Spot-check one ingredient stays byte-identical.
    expect(r.ingredients.fermentable_additions[0]).toEqual(
      RECIPE.ingredients.fermentable_additions[0],
    );
    expect(r.ingredients.hop_additions?.[0]).toEqual(
      RECIPE.ingredients.hop_additions?.[0],
    );
  });

  it("mash schedule survives serialization", () => {
    const text = rebuildFile(RECIPE);
    const r = parseBeerJsonText(text).recipes[0]!;
    expect(r.mash?.mash_steps.length).toBe(RECIPE.mash?.mash_steps.length);
    expect(r.mash?.mash_steps[0]).toEqual(RECIPE.mash?.mash_steps[0]);
  });

  it("rejects malformed JSON with a clear error", () => {
    const result = parseBeerJsonText("{ not json");
    expect(result.recipes).toEqual([]);
    expect(result.error?.code).toBe("import.invalid_json");
  });

  it("rejects valid JSON that isn't BeerJSON-shaped", () => {
    const result = parseBeerJsonText(JSON.stringify({ something: "else" }));
    expect(result.recipes).toEqual([]);
    expect(result.error?.code).toBe("import.not_beerjson");
  });

  it("rejects valid BeerJSON with no recipes inside", () => {
    const empty = JSON.stringify({ beerjson: { version: 2.06, recipes: [] } });
    const result = parseBeerJsonText(empty);
    expect(result.recipes).toEqual([]);
    expect(result.error?.code).toBe("import.no_recipes_beerjson");
  });
});

describe("BeerXML export shape", () => {
  // The Rust-side werb-beerxml crate has its own parsing tests, so the JS
  // round-trip stops at "we produce well-formed XML containing the right
  // top-level elements." Round-trip parsing requires the Tauri runtime and
  // is exercised manually.
  it("emits a well-formed envelope with the recipe inside", () => {
    const xml = recipeToBeerXml(RECIPE);
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain("<RECIPES>");
    expect(xml).toContain("</RECIPES>");
    expect(xml).toContain("<RECIPE>");
    expect(xml).toContain(`<NAME>${RECIPE.name}</NAME>`);
  });

  it("includes every fermentable / hop / yeast addition", () => {
    const xml = recipeToBeerXml(RECIPE);
    const fermentableMatches = xml.match(/<FERMENTABLE>/g) ?? [];
    const hopMatches = xml.match(/<HOP>/g) ?? [];
    const yeastMatches = xml.match(/<YEAST>/g) ?? [];

    expect(fermentableMatches).toHaveLength(
      RECIPE.ingredients.fermentable_additions.length,
    );
    expect(hopMatches).toHaveLength(RECIPE.ingredients.hop_additions?.length ?? 0);
    expect(yeastMatches).toHaveLength(
      RECIPE.ingredients.culture_additions?.length ?? 0,
    );
  });
});
