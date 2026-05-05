import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { recipeToIbuInput, recipeToWaterInput } from "../src/index.js";
import type { BeerJsonFile } from "../src/index.js";
import { computeIbu, computeWater } from "@werb/calc";

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
