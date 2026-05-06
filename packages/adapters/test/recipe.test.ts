import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  recipeToIbuInput,
  recipeToWaterInput,
  recipeToColorInput,
  recipeToGravityInput,
  recipeToSessionPlan,
  recipeToScaleInput,
  applyScale,
  fitMashToTun,
  recipeToStrikeTempInput,
} from "../src/index.js";
import type { BeerJsonFile } from "../src/index.js";
import { computeIbu, computeWater, computeColor, computeGravity, computeScale } from "@werb/calc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../../../examples/double-ipa-mandarina.beerjson");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as BeerJsonFile;
const recipe = fixture.beerjson.recipes![0]!;

describe("recipeToIbuInput — Double IPA fixture", () => {
  it("filters out dry hops, keeps boil additions", () => {
    const input = recipeToIbuInput(recipe);
    // Source file has 4 Mandarina additions: 2 boil (Boil + Aroma), 2 dry hop.
    expect(input.hops).toHaveLength(2);
    const names = input.hops.map((h) => h.name);
    expect(names).toEqual(["Mandarina Bavaria", "Mandarina Bavaria"]);
  });

  it("converts kg to g, preserves alpha and time", () => {
    const input = recipeToIbuInput(recipe);
    expect(input.hops[0]!.amount_g).toBeCloseTo(160, 4);
    expect(input.hops[0]!.alpha_acid_pct).toBe(9.1);
    expect(input.hops[0]!.time_min).toBe(10);
    expect(input.hops[1]!.amount_g).toBeCloseTo(100, 4);
    expect(input.hops[1]!.time_min).toBe(30);
  });

  it("pulls OG and batch size from the recipe", () => {
    const input = recipeToIbuInput(recipe);
    expect(input.og).toBeCloseTo(1.069, 4);
    expect(input.batch_size_l).toBe(22);
  });

  it("end-to-end IBU is in the expected range (claim 67, computed ~108)", () => {
    const out = computeIbu(recipeToIbuInput(recipe));
    expect(out.method).toBe("Tinseth");
    // Hand-computed: 46.67 (10min) + 61.81 (30min) ≈ 108.48
    expect(out.total_ibu).toBeCloseTo(108.48, 1);
    // Significant gap vs claimed 67 — exposes the BeerXML Aroma-vs-whirlpool
    // ambiguity. Captured here so a regression in either direction is loud.
    expect(out.total_ibu).toBeGreaterThan(100);
  });
});

describe("recipeToWaterInput — Double IPA fixture", () => {
  it("sums grain weights, ignores adjuncts (rice hulls)", () => {
    const input = recipeToWaterInput(recipe);
    // 6 + 1 + 0.2 + 0.2 = 7.4 kg of grain. 0.15 kg rice hulls (type=other) excluded.
    expect(input.total_grain_kg).toBeCloseTo(7.4, 4);
  });

  it("derives mash thickness from the first mash step's infuse amount", () => {
    const input = recipeToWaterInput(recipe);
    // 25.5 L strike / 7.4 kg grain = 3.4459 L/kg
    expect(input.mash_thickness_l_per_kg).toBeCloseTo(25.5 / 7.4, 4);
  });

  it("pulls boil time and batch size", () => {
    const input = recipeToWaterInput(recipe);
    expect(input.boil_time_min).toBe(60);
    expect(input.batch_size_l).toBe(22);
  });

  it("end-to-end water volumes are realistic for a 22L all-grain batch", () => {
    const out = computeWater(recipeToWaterInput(recipe));
    // mash_water = 25.5 (matches the recipe's INFUSE_AMOUNT exactly)
    expect(out.mash_water_l).toBeCloseTo(25.5, 2);
    // pre-boil should be > batch_size (loss-adjusted): 26.4 L
    expect(out.pre_boil_volume_l).toBeCloseTo(26.44, 1);
    // total water (mash + sparge): ~33.5 L
    expect(out.total_water_l).toBeCloseTo(33.54, 1);
  });

  it("respects equipment overrides", () => {
    const baseline = computeWater(recipeToWaterInput(recipe));
    const tighter = computeWater(
      recipeToWaterInput(recipe, { evaporation_rate_l_per_hour: 1.5 }),
    );
    // Halving evap rate cuts pre-boil volume by 1.5 L (60min × 1.5 L/h diff).
    expect(baseline.pre_boil_volume_l - tighter.pre_boil_volume_l).toBeCloseTo(1.5, 2);
  });
});

describe("recipeToColorInput / computeColor — Double IPA fixture", () => {
  it("includes every fermentable with mass + color, converts EBC → SRM", () => {
    const input = recipeToColorInput(recipe);
    // 4 grains + rice hulls; rice hulls have color 0 EBC, still included.
    expect(input.fermentables).toHaveLength(5);
    // First fermentable: 6 kg, 8 EBC → ~4.06 SRM
    expect(input.fermentables[0]!.mass_kg).toBeCloseTo(6, 4);
    expect(input.fermentables[0]!.color_srm).toBeCloseTo(8 / 1.97, 3);
  });

  it("computed SRM is in the expected range for a Double IPA (~7.6 SRM, 15 EBC claimed)", () => {
    const out = computeColor(recipeToColorInput(recipe));
    expect(out.method).toBe("Morey");
    expect(out.srm).toBeGreaterThan(4);
    expect(out.srm).toBeLessThan(12);
  });
});

describe("recipeToGravityInput / computeGravity — Double IPA fixture", () => {
  it("classifies grain fermentables as mashed, drops the rice hulls (0% yield)", () => {
    const input = recipeToGravityInput(recipe);
    // 4 grains + 1 adjunct; rice hulls (yield 0%) are filtered out.
    expect(input.fermentables).toHaveLength(4);
    expect(input.fermentables.every((f) => f.category === "mashed")).toBe(true);
    expect(input.efficiency_pct).toBe(75);
  });

  it("predicted OG is close to the recipe's claimed 1.069", () => {
    const out = computeGravity(recipeToGravityInput(recipe));
    // Grain bill: 6 + 1 + 0.2 + 0.2 = 7.4 kg, weighted yield ~80%, 75% eff, 22 L
    // ~ 7.4 × 0.81 × 384 × 0.75 / 22 ≈ 78.4 GU → 1.078
    // Recipe claim 1.069 — gap reflects yield assumption + boil-off model
    expect(out.og).toBeGreaterThan(1.06);
    expect(out.og).toBeLessThan(1.09);
  });
});

describe("recipeToSessionPlan — Double IPA fixture", () => {
  // Deterministic id generator for stable assertions.
  let counter = 0;
  const deps = {
    now: () => new Date("2026-05-05T08:00:00Z"),
    id: () => `step-${counter++}`,
  };
  // Reset between tests
  function reset() {
    counter = 0;
  }

  it("produces draft status, populated steps array, and ISO timestamps", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "double-ipa-mandarina", deps);
    expect(session.status).toBe("draft");
    expect(session.started_at).toBe("2026-05-05T08:00:00.000Z");
    expect(session.recipe_id).toBe("double-ipa-mandarina");
    expect(session.recipe_name).toBe(recipe.name);
    expect(session.steps.length).toBeGreaterThan(0);
  });

  it("expands mash steps + adds sparge / boil / chill / transfer / pitch", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "x", deps);
    const kinds = session.steps.map((s) => s.kind);
    // Mandarina recipe has 2 mash steps (saccharification, smash out)
    expect(kinds.filter((k) => k === "mash")).toHaveLength(2);
    expect(kinds).toContain("prepare_water");
    expect(kinds).toContain("mash_in");
    expect(kinds).toContain("sparge");
    expect(kinds).toContain("boil");
    expect(kinds).toContain("chill");
    expect(kinds).toContain("transfer");
    expect(kinds).toContain("ferment_pitch");
  });

  it("orders prepare_water → mash_in → mash so the brewer hits each phase in sequence", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "x", deps);
    const kinds = session.steps.map((s) => s.kind);
    const prepIdx = kinds.indexOf("prepare_water");
    const mashInIdx = kinds.indexOf("mash_in");
    const firstMashIdx = kinds.indexOf("mash");
    expect(prepIdx).toBeGreaterThanOrEqual(0);
    expect(mashInIdx).toBeGreaterThan(prepIdx);
    expect(firstMashIdx).toBeGreaterThan(mashInIdx);
  });

  it("prepare_water step carries the computed strike temperature", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "x", deps);
    const prep = session.steps.find((s) => s.kind === "prepare_water")!;
    // Mandarina: 25.5 L / 7.4 kg = 3.4459 L/kg, target 67°C, grain 20°C default.
    // T_strike = (0.41 / 3.4459) × (67 − 20) + 67 ≈ 72.59°C
    expect(prep.target_temperature_c).toBeCloseTo(72.59, 1);
  });

  it("strike-temp options propagate through to prepare_water", () => {
    reset();
    const cold = recipeToSessionPlan(recipe, "x", { ...deps, strikeTemp: { grain_temp_c: 5 } });
    const warm = recipeToSessionPlan(recipe, "x", { ...deps, strikeTemp: { grain_temp_c: 25 } });
    const coldTemp = cold.steps.find((s) => s.kind === "prepare_water")!.target_temperature_c!;
    const warmTemp = warm.steps.find((s) => s.kind === "prepare_water")!.target_temperature_c!;
    // Colder grain → hotter strike water needed.
    expect(coldTemp).toBeGreaterThan(warmTemp);
  });

  it("carries mash temperature + duration onto the session step", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "x", deps);
    const firstMash = session.steps.find((s) => s.kind === "mash")!;
    expect(firstMash.target_temperature_c).toBe(67);
    expect(firstMash.target_duration_min).toBe(60);
  });

  it("boil step carries the recipe's boil time", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "x", deps);
    const boil = session.steps.find((s) => s.kind === "boil")!;
    expect(boil.target_duration_min).toBe(60);
    expect(boil.target_temperature_c).toBeUndefined();
  });

  it("pitch step labels every culture", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "x", deps);
    const pitch = session.steps.find((s) => s.kind === "ferment_pitch")!;
    // Mandarina recipe has two yeasts: verdant IPA + US West Coast Yeast
    expect(pitch.label).toContain("verdant IPA");
    expect(pitch.label).toContain("US West Coast Yeast");
  });

  it("every step starts in pending status", () => {
    reset();
    const session = recipeToSessionPlan(recipe, "x", deps);
    expect(session.steps.every((s) => s.status === "pending")).toBe(true);
  });
});

describe("recipeToScaleInput / applyScale — Double IPA fixture", () => {
  it("recipeToScaleInput pulls from recipe + target", () => {
    const input = recipeToScaleInput(recipe, { batch_size_l: 25, efficiency_pct: 70 });
    expect(input.from_batch_size_l).toBe(recipe.batch_size.value);
    expect(input.to_batch_size_l).toBe(25);
    expect(input.from_efficiency_pct).toBe(recipe.efficiency!.brewhouse!.value);
    expect(input.to_efficiency_pct).toBe(70);
  });

  it("applyScale updates batch_size and efficiency to the target", () => {
    const out = computeScale(recipeToScaleInput(recipe, { batch_size_l: 25, efficiency_pct: 70 }));
    const scaled = applyScale(recipe, out);
    expect(scaled.batch_size).toEqual({ value: 25, unit: "l" });
    expect(scaled.efficiency?.brewhouse).toEqual({ value: 70, unit: "%" });
  });

  it("applyScale scales fermentables by fermentable_factor and hops by volume_factor", () => {
    const out = computeScale(recipeToScaleInput(recipe, { batch_size_l: 25, efficiency_pct: 70 }));
    const scaled = applyScale(recipe, out);
    const origFermentable = recipe.ingredients.fermentable_additions[0]!;
    const newFermentable = scaled.ingredients.fermentable_additions[0]!;
    if ("value" in origFermentable.amount && "value" in newFermentable.amount) {
      expect(newFermentable.amount.value).toBeCloseTo(
        origFermentable.amount.value * out.fermentable_factor,
        6,
      );
    }
    const origHop = recipe.ingredients.hop_additions![0]!;
    const newHop = scaled.ingredients.hop_additions![0]!;
    if ("value" in origHop.amount && "value" in newHop.amount) {
      expect(newHop.amount.value).toBeCloseTo(origHop.amount.value * out.volume_factor, 6);
    }
  });

  it("applyScale leaves the original recipe unmutated", () => {
    const before = JSON.stringify(recipe.ingredients.fermentable_additions[0]!.amount);
    const out = computeScale(recipeToScaleInput(recipe, { batch_size_l: 30, efficiency_pct: 60 }));
    applyScale(recipe, out);
    const after = JSON.stringify(recipe.ingredients.fermentable_additions[0]!.amount);
    expect(before).toBe(after);
  });

  it("applyScale scales mash step infuse amounts by volume_factor", () => {
    // Without this, the water calc derives mash thickness from a
    // fixed-volume strike against a shrunken grain bill — sparge
    // explodes to compensate.
    const out = computeScale(recipeToScaleInput(recipe, { batch_size_l: 10, efficiency_pct: 75 }));
    const scaled = applyScale(recipe, out);
    const origStep = recipe.mash!.mash_steps[0]!;
    const newStep = scaled.mash!.mash_steps[0]!;
    if (origStep.amount && newStep.amount) {
      expect(newStep.amount.value).toBeCloseTo(origStep.amount.value * out.volume_factor, 6);
    } else {
      throw new Error("fixture must have a mash step with an amount for this test");
    }
  });

  it("identity scale (same target) leaves amounts within rounding error", () => {
    const target = {
      batch_size_l: recipe.batch_size.value,
      efficiency_pct: recipe.efficiency!.brewhouse!.value,
    };
    const out = computeScale(recipeToScaleInput(recipe, target));
    const scaled = applyScale(recipe, out);
    const orig = recipe.ingredients.fermentable_additions[0]!.amount;
    const next = scaled.ingredients.fermentable_additions[0]!.amount;
    if ("value" in orig && "value" in next) {
      expect(next.value).toBeCloseTo(orig.value, 6);
    }
  });
});

describe("fitMashToTun — Double IPA fixture", () => {
  it("passes through unchanged when strike water already fits", () => {
    const result = fitMashToTun(recipe, { capacity_l: 100 });
    expect(result.capped).toBeNull();
    expect(result.recipe).toBe(recipe);
  });

  it("caps strike water when it exceeds the tun capacity", () => {
    // Mandarina fixture has ~7 kg grain → ~5 L grain volume.
    // A 30 L tun, 15% headspace → 30*0.85 - 5 = 20.5 L max strike.
    // The fixture's actual strike is ~25 L, so it should clamp.
    const result = fitMashToTun(recipe, { capacity_l: 30 });
    expect(result.capped).not.toBeNull();
    if (result.capped) {
      expect(result.capped.to_l).toBeLessThan(result.capped.from_l);
      const newStep = result.recipe.mash!.mash_steps[0]!;
      if (newStep.amount && "value" in newStep.amount) {
        expect(newStep.amount.value).toBeCloseTo(result.capped.to_l, 6);
      }
    }
  });

  it("respects dead_space_l when computing usable capacity", () => {
    const without = fitMashToTun(recipe, { capacity_l: 30 });
    const withDead = fitMashToTun(recipe, { capacity_l: 30, dead_space_l: 5 });
    if (without.capped && withDead.capped) {
      // Less usable space → tighter cap.
      expect(withDead.capped.to_l).toBeLessThan(without.capped.to_l);
    }
  });

  it("leaves the original recipe unmutated", () => {
    const before = JSON.stringify(recipe.mash);
    fitMashToTun(recipe, { capacity_l: 10 });
    const after = JSON.stringify(recipe.mash);
    expect(before).toBe(after);
  });

  it("returns the recipe untouched when there's no mash or no first-step amount", () => {
    const noMash = { ...recipe, mash: undefined };
    const result = fitMashToTun(noMash, { capacity_l: 10 });
    expect(result.capped).toBeNull();
    expect(result.recipe).toBe(noMash);
  });
});

describe("recipeToStrikeTempInput — Double IPA fixture", () => {
  it("derives the mash target from the first mash step's step_temperature", () => {
    const input = recipeToStrikeTempInput(recipe);
    expect(input?.mash_target_c).toBe(67);
  });

  it("derives thickness from first-step amount / total grain weight", () => {
    const input = recipeToStrikeTempInput(recipe);
    // 25.5 L / 7.4 kg = 3.4459 L/kg
    expect(input?.thickness_l_per_kg).toBeCloseTo(25.5 / 7.4, 4);
  });

  it("defaults grain_temp_c to 20°C when no option is provided", () => {
    const input = recipeToStrikeTempInput(recipe);
    expect(input?.grain_temp_c).toBe(20);
  });

  it("respects an explicit grain_temp_c option", () => {
    const input = recipeToStrikeTempInput(recipe, { grain_temp_c: 12 });
    expect(input?.grain_temp_c).toBe(12);
  });

  it("returns null when there's no mash defined", () => {
    const noMash = { ...recipe, mash: undefined };
    expect(recipeToStrikeTempInput(noMash)).toBeNull();
  });
});
