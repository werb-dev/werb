import { describe, it, expect } from "vitest";
import { suggestWaterAdditions } from "../src/water-suggest.js";
import { computeWaterAdditions } from "../src/water-additions.js";
import type { WaterSuggestInput } from "@werb/types";

const ZERO = {
  ca_ppm: 0,
  mg_ppm: 0,
  na_ppm: 0,
  cl_ppm: 0,
  so4_ppm: 0,
  hco3_ppm: 0,
};

function input(over: Partial<WaterSuggestInput> = {}): WaterSuggestInput {
  return { water_volume_l: 20, source: ZERO, target: ZERO, ...over };
}

function ionError(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  return ["ca_ppm", "mg_ppm", "na_ppm", "cl_ppm", "so4_ppm", "hco3_ppm"].reduce(
    (sum, k) => sum + Math.abs(a[k] - b[k]),
    0,
  );
}

describe("suggestWaterAdditions", () => {
  it("hits a single-salt target exactly (gypsum-shaped Ca/SO4 from RO)", () => {
    // 5 g gypsum in 20 L → Ca 58.2, SO4 139.5 (see water-additions test).
    const out = suggestWaterAdditions(
      input({ target: { ...ZERO, ca_ppm: 58.2, so4_ppm: 139.5 } }),
    );
    expect(out.additions.gypsum_g).toBeCloseTo(5, 1);
    expect(out.additions.calcium_chloride_g).toBe(0);
    expect(out.additions.epsom_g).toBe(0);
    expect(ionError(out.achieved, {
      ca_ppm: 58.2,
      mg_ppm: 0,
      na_ppm: 0,
      cl_ppm: 0,
      so4_ppm: 139.5,
      hco3_ppm: 0,
    })).toBeLessThan(1);
  });

  it("never suggests negative grams and only uses the five soluble salts", () => {
    const out = suggestWaterAdditions(
      input({
        target: { ...ZERO, ca_ppm: 80, cl_ppm: 100, so4_ppm: 150, mg_ppm: 10 },
      }),
    );
    for (const g of Object.values(out.additions)) expect(g).toBeGreaterThanOrEqual(0);
    expect(Object.keys(out.additions)).not.toContain("chalk_g");
  });

  it("moves a real source meaningfully toward a Burton-ish target", () => {
    const source = { ...ZERO, ca_ppm: 20, hco3_ppm: 30 };
    const target = {
      ...ZERO,
      ca_ppm: 275,
      so4_ppm: 610,
      cl_ppm: 35,
      mg_ppm: 40,
      na_ppm: 25,
      hco3_ppm: 270,
    };
    const out = suggestWaterAdditions(input({ source, target }));
    // The achieved profile is closer to target than the bare source was.
    expect(ionError(out.achieved, target)).toBeLessThan(ionError(source, target));
  });

  it("achieved matches computeWaterAdditions fed the same suggestion", () => {
    const source = { ...ZERO, ca_ppm: 20 };
    const target = { ...ZERO, ca_ppm: 90, cl_ppm: 120, so4_ppm: 60 };
    const out = suggestWaterAdditions(input({ source, target }));
    const forward = computeWaterAdditions({
      water_volume_l: 20,
      source,
      additions: out.additions,
    });
    expect(forward.ca_ppm).toBeCloseTo(out.achieved.ca_ppm, 4);
    expect(forward.cl_ppm).toBeCloseTo(out.achieved.cl_ppm, 4);
    expect(forward.so4_ppm).toBeCloseTo(out.achieved.so4_ppm, 4);
  });

  it("suggests nothing when the source already exceeds the target (salts can't subtract)", () => {
    const out = suggestWaterAdditions(
      input({
        source: { ...ZERO, ca_ppm: 150, so4_ppm: 300 },
        target: { ...ZERO, ca_ppm: 50, so4_ppm: 100 },
      }),
    );
    expect(out.additions.gypsum_g).toBe(0);
    // Residual stays positive — we overshoot because we can't remove ions.
    expect(out.residual.ca_ppm).toBeGreaterThan(0);
  });
});
