import { describe, expect, it } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import type { WerbSession } from "@werb/types";
import { buildSessionPdf, deriveActuals } from "../src/data/session-pdf.ts";
import { DEFAULT_PREFS } from "../src/data/units-format.ts";

const RECIPE: BeerJsonRecipe = {
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
    ],
    hop_additions: [
      {
        name: "Cascade",
        alpha_acid: { value: 5.5, unit: "%" },
        amount: { value: 0.028, unit: "kg" },
        form: "pellet",
        timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
      },
    ],
    culture_additions: [
      { name: "US-05", type: "ale", form: "dry", amount: { value: 11, unit: "g" } },
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

const FULL_SESSION: WerbSession = {
  id: "s1",
  recipe_id: "r1",
  recipe_name: "Cascade IPA",
  status: "completed",
  started_at: "2026-05-01T09:00:00.000Z",
  completed_at: "2026-05-01T14:30:00.000Z",
  steps: [
    {
      id: "st1",
      kind: "mash",
      label: "Saccharification",
      status: "done",
      target_temperature_c: 67,
      target_duration_min: 60,
      started_at: "2026-05-01T09:30:00.000Z",
      completed_at: "2026-05-01T10:30:00.000Z",
      notes: "Hit 66.5",
    },
  ],
  measurements: [
    { at: "2026-05-01T12:00:00.000Z", kind: "gravity_sg", value: 1.063 },
    { at: "2026-05-08T12:00:00.000Z", kind: "gravity_sg", value: 1.014 },
    { at: "2026-05-01T12:00:00.000Z", kind: "temperature_c", value: 20 },
  ],
  notes: "Smooth brew day. Slight boil-over.",
  tasting: {
    tasted_at: "2026-05-29T18:00:00.000Z",
    axes: {
      bitterness: 4,
      sweetness: 2,
      sourness: 0,
      hop_character: 5,
      malt_character: 3,
      body: 3,
      carbonation: 4,
    },
    overall_rating: 4,
    notes: "Big citrus nose.",
    tags: ["best one yet", "great head"],
  },
};

function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // "%PDF"
  );
}

describe("deriveActuals", () => {
  it("reads OG from the first gravity reading and FG from the last", () => {
    expect(deriveActuals(FULL_SESSION)).toMatchObject({ og: 1.063, fg: 1.014 });
  });

  it("estimates ABV from OG/FG when no ABV reading exists", () => {
    const { abv } = deriveActuals(FULL_SESSION);
    expect(abv).toBeCloseTo((1.063 - 1.014) * 131.25, 3);
  });

  it("prefers a measured ABV over the estimate", () => {
    const withAbv: WerbSession = {
      ...FULL_SESSION,
      measurements: [
        ...(FULL_SESSION.measurements ?? []),
        { at: "2026-05-09T12:00:00.000Z", kind: "abv_pct", value: 6.7 },
      ],
    };
    expect(deriveActuals(withAbv).abv).toBe(6.7);
  });

  it("leaves FG undefined with only one gravity reading", () => {
    const single: WerbSession = {
      ...FULL_SESSION,
      measurements: [{ at: "2026-05-01T12:00:00.000Z", kind: "gravity_sg", value: 1.063 }],
    };
    const actuals = deriveActuals(single);
    expect(actuals.og).toBe(1.063);
    expect(actuals.fg).toBeUndefined();
    expect(actuals.abv).toBeUndefined();
  });

  it("returns nothing for a session with no measurements", () => {
    const bare: WerbSession = { ...FULL_SESSION, measurements: undefined };
    expect(deriveActuals(bare)).toEqual({});
  });
});

describe("buildSessionPdf", () => {
  it("produces a valid PDF for a full session + recipe", async () => {
    const bytes = await buildSessionPdf(FULL_SESSION, RECIPE, DEFAULT_PREFS);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(isPdf(bytes)).toBe(true);
  });

  it("renders from the session snapshot when the recipe was deleted", async () => {
    const bytes = await buildSessionPdf(FULL_SESSION, undefined, DEFAULT_PREFS);
    expect(isPdf(bytes)).toBe(true);
  });

  it("handles a bare draft session with no steps, measurements, or tasting", async () => {
    const bare: WerbSession = {
      id: "s2",
      recipe_id: "r2",
      recipe_name: "Empty",
      status: "draft",
      started_at: "2026-06-01T09:00:00.000Z",
      steps: [],
    };
    const bytes = await buildSessionPdf(bare, undefined, DEFAULT_PREFS);
    expect(isPdf(bytes)).toBe(true);
  });
});
