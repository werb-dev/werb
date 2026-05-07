import { describe, it, expect } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import { recipeToBeerXml } from "../src/data/recipe-export.ts";

const FULL_RECIPE: BeerJsonRecipe = {
  name: "Cascade IPA",
  type: "all grain",
  author: "Brewer",
  batch_size: { value: 20, unit: "l" },
  efficiency: { brewhouse: { value: 75, unit: "%" } },
  style: {
    name: "American IPA",
    category: "India Pale Ale",
    category_number: 21,
    style_letter: "A",
    style_guide: "BJCP 2015",
    type: "ale",
  },
  ingredients: {
    fermentable_additions: [
      {
        name: "Pale 2-Row",
        type: "grain",
        amount: { value: 4.5, unit: "kg" },
        yield: { fine_grind: { value: 80, unit: "%" } },
        color: { value: 4, unit: "EBC" },
      },
      {
        name: "Crystal 60",
        type: "grain",
        amount: { value: 0.5, unit: "kg" },
        yield: { fine_grind: { value: 74, unit: "%" } },
        color: { value: 145, unit: "EBC" },
      },
    ],
    hop_additions: [
      {
        name: "Cascade",
        alpha_acid: { value: 5.5, unit: "%" },
        amount: { value: 0.028, unit: "kg" },
        form: "pellet",
        timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
      },
      {
        name: "Centennial",
        alpha_acid: { value: 9, unit: "%" },
        amount: { value: 0.028, unit: "kg" },
        form: "pellet",
        timing: { use: "add_to_fermentation", time: { value: 4320, unit: "min" } },
      },
    ],
    culture_additions: [
      {
        name: "Safale US-05",
        type: "ale",
        form: "dry",
        amount: { value: 11, unit: "g" },
        producer: "Fermentis",
        product_id: "US-05",
        attenuation: { value: 78, unit: "%" },
      },
    ],
    miscellaneous_additions: [
      {
        name: "Whirlfloc",
        type: "fining",
        amount: { value: 1, unit: "g" },
        timing: { use: "add_to_boil", time: { value: 15, unit: "min" } },
      },
    ],
  },
  mash: {
    name: "Single Infusion",
    grain_temperature: { value: 20, unit: "C" },
    mash_steps: [
      {
        name: "Saccharification",
        type: "infusion",
        amount: { value: 15, unit: "l" },
        step_temperature: { value: 67, unit: "C" },
        step_time: { value: 60, unit: "min" },
      },
    ],
  },
  boil: { boil_time: { value: 60, unit: "min" } },
  ibu_estimate: { ibu: { value: 45, unit: "IBUs" } },
  color_estimate: { value: 9.5, unit: "SRM" },
  original_gravity: { value: 1.062, unit: "sg" },
  final_gravity: { value: 1.012, unit: "sg" },
};

describe("recipeToBeerXml", () => {
  it("emits a well-formed BeerXML 1.0 envelope", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain("<RECIPES>");
    expect(xml).toContain("</RECIPES>");
    expect(xml).toContain("<RECIPE>");
    expect(xml).toContain("</RECIPE>");
  });

  it("preserves recipe-level metadata", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<NAME>Cascade IPA</NAME>");
    expect(xml).toContain("<TYPE>All Grain</TYPE>");
    expect(xml).toContain("<BREWER>Brewer</BREWER>");
    expect(xml).toContain("<BATCH_SIZE>20</BATCH_SIZE>");
    expect(xml).toContain("<BOIL_TIME>60</BOIL_TIME>");
    expect(xml).toContain("<EFFICIENCY>75</EFFICIENCY>");
  });

  it("emits the style block when present", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<STYLE>");
    expect(xml).toContain("<NAME>American IPA</NAME>");
    expect(xml).toContain("<CATEGORY_NUMBER>21</CATEGORY_NUMBER>");
    expect(xml).toContain("<STYLE_LETTER>A</STYLE_LETTER>");
  });

  it("emits a FERMENTABLES block with grain entries in order", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    const fermentablesIdx = xml.indexOf("<FERMENTABLES>");
    const paleIdx = xml.indexOf("Pale 2-Row");
    const crystalIdx = xml.indexOf("Crystal 60");
    const fermentablesEndIdx = xml.indexOf("</FERMENTABLES>");
    expect(fermentablesIdx).toBeGreaterThanOrEqual(0);
    expect(paleIdx).toBeGreaterThan(fermentablesIdx);
    expect(crystalIdx).toBeGreaterThan(paleIdx);
    expect(fermentablesEndIdx).toBeGreaterThan(crystalIdx);
    expect(xml).toContain("<TYPE>Grain</TYPE>");
    expect(xml).toContain("<AMOUNT>4.5</AMOUNT>");
  });

  it("maps BeerJSON hop use back to BeerXML labels", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<USE>Boil</USE>");
    expect(xml).toContain("<USE>Dry Hop</USE>");
  });

  it("emits hops with form, alpha, time, and amount in kg", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<NAME>Cascade</NAME>");
    expect(xml).toContain("<ALPHA>5.5</ALPHA>");
    expect(xml).toContain("<AMOUNT>0.03</AMOUNT>"); // 0.028 rounds to 0.03 at 2 dp
    expect(xml).toContain("<FORM>Pellet</FORM>");
  });

  it("emits a YEASTS block with mass / weight flags", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<YEASTS>");
    expect(xml).toContain("<NAME>Safale US-05</NAME>");
    expect(xml).toContain("<TYPE>Ale</TYPE>");
    expect(xml).toContain("<FORM>Dry</FORM>");
    expect(xml).toContain("<AMOUNT_IS_WEIGHT>TRUE</AMOUNT_IS_WEIGHT>");
    expect(xml).toContain("<LABORATORY>Fermentis</LABORATORY>");
    expect(xml).toContain("<PRODUCT_ID>US-05</PRODUCT_ID>");
  });

  it("emits a MISCS block when present", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<MISCS>");
    expect(xml).toContain("<NAME>Whirlfloc</NAME>");
    expect(xml).toContain("<TYPE>Fining</TYPE>");
  });

  it("emits a MASH block with infusion steps", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<MASH>");
    expect(xml).toContain("<MASH_STEP>");
    expect(xml).toContain("<TYPE>Infusion</TYPE>");
    expect(xml).toContain("<INFUSE_AMOUNT>15</INFUSE_AMOUNT>");
    expect(xml).toContain("<STEP_TEMP>67</STEP_TEMP>");
    expect(xml).toContain("<STEP_TIME>60</STEP_TIME>");
  });

  it("emits estimate fields with their unit suffix", () => {
    const xml = recipeToBeerXml(FULL_RECIPE);
    expect(xml).toContain("<EST_OG>1.062 SG</EST_OG>");
    expect(xml).toContain("<EST_FG>1.012 SG</EST_FG>");
    expect(xml).toContain("<EST_COLOR>9.5 SRM</EST_COLOR>");
    expect(xml).toContain("<IBU>45</IBU>");
  });

  it("escapes XML special characters in names and notes", () => {
    const tricky: BeerJsonRecipe = {
      ...FULL_RECIPE,
      name: 'Foo & "bar" <test>',
      notes: "5 < 6 & 7 > 4",
    };
    const xml = recipeToBeerXml(tricky);
    expect(xml).toContain("Foo &amp; &quot;bar&quot; &lt;test&gt;");
    expect(xml).toContain("5 &lt; 6 &amp; 7 &gt; 4");
  });

  it("omits sections that don't have data", () => {
    const minimal: BeerJsonRecipe = {
      name: "Bare",
      type: "extract",
      author: "Anon",
      batch_size: { value: 19, unit: "l" },
      efficiency: { brewhouse: { value: 75, unit: "%" } },
      ingredients: { fermentable_additions: [] },
    };
    const xml = recipeToBeerXml(minimal);
    expect(xml).not.toContain("<STYLE>");
    expect(xml).not.toContain("<FERMENTABLES>");
    expect(xml).not.toContain("<HOPS>");
    expect(xml).not.toContain("<YEASTS>");
    expect(xml).not.toContain("<MISCS>");
    expect(xml).not.toContain("<MASH>");
  });
});
