import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BeerJsonRecipe } from "@werb/adapters";
import { validateBeerJson } from "@werb/validate";

/**
 * Cross-stack end-to-end check for the BeerXML → BeerJSON pipeline.
 *
 * The Rust `werb-beerxml` crate, compiled to WASM, hands a strongly-typed
 * `werb_beerjson::Recipe` back to JS. Anything that doesn't satisfy the
 * vendored BeerJSON 2.x schema is a schema-driven correctness regression
 * — surface it here so it shows up alongside the user-facing import
 * pipeline rather than buried in the crate tests.
 *
 * Each case wraps a recipe in the root document shape and runs the
 * full ajv validator from `@werb/validate`. That's the same validator
 * the import path uses, so a green test here is a guarantee that the
 * generated `.beerjson` file would re-import cleanly.
 *
 * The production `parseBeerXmlText` initializes wasm-bindgen with no
 * arguments, expecting the browser/Tauri webview to `fetch()` the
 * `.wasm` binary. Happy-DOM can't do that, so we side-step by loading
 * the file from disk and passing its buffer to `wasm.default()`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(
  __dirname,
  "../../../crates/werb-beerxml-wasm/pkg/werb_beerxml_wasm_bg.wasm",
);

type WasmModule = {
  default: (input?: unknown) => Promise<unknown>;
  parseBeerXmlJson: (xml: string) => string;
};

let wasm: WasmModule;

beforeAll(async () => {
  wasm = (await import(
    "../../../crates/werb-beerxml-wasm/pkg/werb_beerxml_wasm.js"
  )) as WasmModule;
  await wasm.default({ module_or_path: readFileSync(WASM_PATH) });
});

function asDocument(recipe: BeerJsonRecipe): unknown {
  return { beerjson: { version: 2.06, recipes: [recipe] } };
}

function importXml(xml: string): BeerJsonRecipe {
  const recipes = JSON.parse(wasm.parseBeerXmlJson(xml)) as BeerJsonRecipe[];
  expect(recipes).toHaveLength(1);
  return recipes[0]!;
}

describe("BeerXML → BeerJSON validates against the schema", () => {
  it("round-trips the christmas-brew bug-report scenario", () => {
    // Same shape as the user-reported import that broke at
    // `/style/category_number: must be integer`. Worth keeping as a
    // canary even though the field-level Rust tests already cover it.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Christmas Brew</NAME>
    <VERSION>1</VERSION>
    <TYPE>All Grain</TYPE>
    <BATCH_SIZE>30.0</BATCH_SIZE>
    <BOIL_SIZE>38.2</BOIL_SIZE>
    <BOIL_TIME>60.0</BOIL_TIME>
    <EFFICIENCY>75.0</EFFICIENCY>
    <STYLE>
      <NAME>Winter Seasonal Beer</NAME>
      <VERSION>1</VERSION>
      <CATEGORY>Spiced Beer</CATEGORY>
      <CATEGORY_NUMBER>30</CATEGORY_NUMBER>
      <STYLE_LETTER>C</STYLE_LETTER>
      <STYLE_GUIDE>BJCP 2015</STYLE_GUIDE>
      <TYPE>Mixed</TYPE>
    </STYLE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pale Ale Malt</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
        <AMOUNT>5.0</AMOUNT><YIELD>78.0</YIELD><COLOR>8.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <YEASTS>
      <YEAST>
        <NAME>New World Strong Ale</NAME><VERSION>1</VERSION>
        <TYPE>Ale</TYPE><FORM>Dry</FORM>
        <AMOUNT>0.020</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT>
      </YEAST>
    </YEASTS>
  </RECIPE>
</RECIPES>`;
    const recipe = importXml(xml);
    const result = validateBeerJson(asDocument(recipe));
    if (!result.valid) {
      console.error("validation errors:", result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("survives a bare-minimum recipe with no optional fields", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Bare</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  </RECIPE>
</RECIPES>`;
    const recipe = importXml(xml);
    const result = validateBeerJson(asDocument(recipe));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
  });

  it("handles every ingredient kind in one recipe", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Everything</NAME><VERSION>1</VERSION>
    <TYPE>All Grain</TYPE>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <BOIL_TIME>60.0</BOIL_TIME>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pale</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
        <AMOUNT>4.0</AMOUNT><YIELD>80.0</YIELD><COLOR>2.0</COLOR>
      </FERMENTABLE>
      <FERMENTABLE>
        <NAME>Sugar</NAME><VERSION>1</VERSION><TYPE>Sugar</TYPE>
        <AMOUNT>0.5</AMOUNT><YIELD>100.0</YIELD><COLOR>0.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP><NAME>Magnum</NAME><VERSION>1</VERSION><ALPHA>13.0</ALPHA>
        <AMOUNT>0.025</AMOUNT><USE>Boil</USE><TIME>60.0</TIME>
        <FORM>Pellet</FORM></HOP>
      <HOP><NAME>Cascade</NAME><VERSION>1</VERSION><ALPHA>5.5</ALPHA>
        <AMOUNT>0.030</AMOUNT><USE>Dry Hop</USE><TIME>4320.0</TIME>
        <FORM>Pellet</FORM></HOP>
    </HOPS>
    <YEASTS>
      <YEAST><NAME>US-05</NAME><VERSION>1</VERSION><TYPE>Ale</TYPE>
        <FORM>Dry</FORM><AMOUNT>0.011</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></YEAST>
    </YEASTS>
    <MISCS>
      <MISC><NAME>Whirlfloc</NAME><VERSION>1</VERSION><TYPE>Fining</TYPE>
        <USE>Boil</USE><TIME>15.0</TIME><AMOUNT>0.001</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
    </MISCS>
    <MASH>
      <NAME>Single Infusion</NAME><VERSION>1</VERSION>
      <GRAIN_TEMP>20.0</GRAIN_TEMP>
      <MASH_STEPS>
        <MASH_STEP><NAME>Sacc</NAME><VERSION>1</VERSION>
          <TYPE>Infusion</TYPE>
          <INFUSE_AMOUNT>15.0</INFUSE_AMOUNT>
          <STEP_TEMP>67.0</STEP_TEMP><STEP_TIME>60.0</STEP_TIME>
        </MASH_STEP>
      </MASH_STEPS>
    </MASH>
  </RECIPE>
</RECIPES>`;
    const recipe = importXml(xml);
    const result = validateBeerJson(asDocument(recipe));
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
  });
});
