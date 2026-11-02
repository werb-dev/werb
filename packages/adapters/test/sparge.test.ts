import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  applyScale,
  isSpargeStep,
  preBoilMismatch,
  recipeToSessionPlan,
  recipeToSpargeInput,
  recipeToScaleInput,
  type BeerJsonFile,
  type BeerJsonRecipe,
  type MashStep,
} from "../src/index.js";
import { computeScale, computeSparge } from "@werb/calc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../../../examples/double-ipa-mandarina.beerjson");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as BeerJsonFile;
const recipe = fixture.beerjson.recipes![0]!;

const rest = (temp: number, type: MashStep["type"] = "infusion"): MashStep => ({
  name: type,
  type,
  step_temperature: { value: temp, unit: "C" },
  step_time: { value: 60, unit: "min" },
});

const withMash = (steps: MashStep[]): BeerJsonRecipe => ({
  ...recipe,
  mash: { name: "Mash", grain_temperature: { value: 20, unit: "C" }, mash_steps: steps },
});

const withPreBoil = (liters: number): BeerJsonRecipe => ({
  ...recipe,
  boil: { ...recipe.boil, pre_boil_size: { value: liters, unit: "l" } },
});

const deps = () => {
  let n = 0;
  return { now: () => new Date("2026-11-02T08:00:00Z"), id: () => `id-${n++}` };
};

describe("recipeToSpargeInput", () => {
  it("takes grain, method and equipment, and the last rest's temperature", () => {
    // Mandarina: 67 °C rest then a 75 °C mash-out.
    const input = recipeToSpargeInput(recipe, 12, {
      method: "batch",
      grain_absorption_l_per_kg: 1,
      mash_tun_capacity_l: 30,
    });
    expect(input).toMatchObject({
      method: "batch",
      sparge_water_l: 12,
      mash_temp_c: 75,
      grain_absorption_l_per_kg: 1,
      mash_tun_capacity_l: 30,
    });
    expect(input.grain_kg).toBeCloseTo(7.4, 6);
  });

  it("defaults to fly sparge", () => {
    expect(recipeToSpargeInput(recipe, 12).method).toBe("fly");
  });

  it("skips sparge and drain steps when finding the last rest", () => {
    const r = withMash([rest(66), rest(80, "drain mash tun"), rest(78, "sparge")]);
    expect(recipeToSpargeInput(r, 10).mash_temp_c).toBe(66);
  });

  it("prefers the rest's end temperature (the bed has cooled)", () => {
    const r = withMash([{ ...rest(67), end_temperature: { value: 63, unit: "C" } }]);
    expect(recipeToSpargeInput(r, 10).mash_temp_c).toBe(63);
  });

  it("falls back to 67 °C without a mash schedule", () => {
    const { mash: _mash, ...noMash } = recipe;
    expect(recipeToSpargeInput(noMash, 10).mash_temp_c).toBe(67);
  });

  it("clamps negative sparge water to zero", () => {
    expect(recipeToSpargeInput(recipe, -2).sparge_water_l).toBe(0);
  });

  it("feeds computeSparge end to end", () => {
    const r = withMash([rest(67)]);
    const out = computeSparge(recipeToSpargeInput(r, 10, { method: "batch" }));
    expect(out.water_temp_c).toBeGreaterThan(75);
  });
});

describe("recipeToSessionPlan — sparge step", () => {
  const sparge = (r: BeerJsonRecipe, extra = {}) =>
    recipeToSessionPlan(r, "x", { ...deps(), ...extra }).steps.find((s) => s.kind === "sparge");

  it("defaults to 75 °C", () => {
    expect(sparge(recipe)?.target_temperature_c).toBe(75);
  });

  it("uses the computed sparge temperature", () => {
    expect(sparge(recipe, { spargeTempC: 79.4 })?.target_temperature_c).toBe(79.4);
  });

  it("a recipe sparge step sets the temperature and is not a mash rest", () => {
    const r = withMash([rest(67), rest(78, "sparge")]);
    const steps = recipeToSessionPlan(r, "x", { ...deps(), spargeTempC: 80 }).steps;
    expect(steps.filter((s) => s.kind === "mash")).toHaveLength(1);
    expect(steps.filter((s) => s.kind === "sparge")).toHaveLength(1);
    expect(steps.find((s) => s.kind === "sparge")?.target_temperature_c).toBe(78);
  });

  it("BIAB drops a recipe sparge step along with the sparge", () => {
    const r = withMash([rest(67), rest(78, "sparge")]);
    const kinds = recipeToSessionPlan(r, "x", { ...deps(), biab: true }).steps.map((s) => s.kind);
    expect(kinds).not.toContain("sparge");
    expect(kinds.filter((k) => k === "mash")).toHaveLength(1);
  });
});

describe("isSpargeStep", () => {
  it("matches only the sparge type", () => {
    expect(isSpargeStep(rest(78, "sparge"))).toBe(true);
    expect(isSpargeStep(rest(78, "drain mash tun"))).toBe(false);
    expect(isSpargeStep(rest(67))).toBe(false);
  });
});

describe("preBoilMismatch", () => {
  it("null when the recipe has no pre-boil volume", () => {
    expect(preBoilMismatch(recipe, 30)).toBeNull();
  });

  it("flags the Wild Hop SMaSH case: 9.5 L in the recipe, 10.8 L from the profile", () => {
    expect(preBoilMismatch(withPreBoil(9.5), 10.8)).toEqual({ recipe_l: 9.5, computed_l: 10.8 });
  });

  it("tolerates 0.5 L on small batches", () => {
    expect(preBoilMismatch(withPreBoil(9.5), 9.3)).toBeNull();
    expect(preBoilMismatch(withPreBoil(9.5), 9.9)).toBeNull();
  });

  it("tolerates 5 % on big batches", () => {
    expect(preBoilMismatch(withPreBoil(30), 31.4)).toBeNull();
    expect(preBoilMismatch(withPreBoil(30), 31.6)).not.toBeNull();
  });

  it("reads the recipe's unit", () => {
    const gallons: BeerJsonRecipe = {
      ...recipe,
      boil: { ...recipe.boil, pre_boil_size: { value: 7, unit: "gal" } },
    };
    expect(preBoilMismatch(gallons, 26.5)).toBeNull();
    expect(preBoilMismatch(gallons, 30)?.recipe_l).toBeCloseTo(26.5, 1);
  });
});

describe("applyScale — pre-boil volume", () => {
  it("scales the recipe's pre-boil volume with the batch", () => {
    const r = withPreBoil(30);
    const out = computeScale(
      recipeToScaleInput(r, {
        batch_size_l: r.batch_size.value / 2,
        efficiency_pct: r.efficiency.brewhouse?.value ?? 75,
      }),
    );
    expect(applyScale(r, out).boil?.pre_boil_size?.value).toBeCloseTo(15, 6);
  });

  it("leaves a recipe without one alone", () => {
    const out = computeScale(
      recipeToScaleInput(recipe, { batch_size_l: 10, efficiency_pct: 75 }),
    );
    expect(applyScale(recipe, out).boil?.pre_boil_size).toBeUndefined();
  });
});
