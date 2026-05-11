import { describe, it, expect } from "vitest";
import { computeWaterAdditions } from "../src/water-additions.js";
import type { WaterAdditionsInput } from "@werb/types";

const ZERO_IONS = {
  ca_ppm: 0,
  mg_ppm: 0,
  na_ppm: 0,
  cl_ppm: 0,
  so4_ppm: 0,
  hco3_ppm: 0,
};

function input(over: Partial<WaterAdditionsInput> = {}): WaterAdditionsInput {
  return {
    water_volume_l: 20,
    source: ZERO_IONS,
    additions: {},
    ...over,
  };
}

describe("computeWaterAdditions", () => {
  it("returns source ions unchanged when no salts are added", () => {
    const out = computeWaterAdditions(
      input({ source: { ...ZERO_IONS, ca_ppm: 30, hco3_ppm: 50 } }),
    );
    expect(out.ca_ppm).toBe(30);
    expect(out.hco3_ppm).toBe(50);
    expect(out.so4_ppm).toBe(0);
  });

  it("gypsum adds calcium AND sulfate in the expected ratio", () => {
    // 5 g of gypsum dihydrate in 20 L
    // ppm = 1000 × frac × g / L → Ca: 0.2328 × 5 × 1000 / 20 = 58.2
    //                              SO4: 0.5580 × 5 × 1000 / 20 = 139.5
    const out = computeWaterAdditions(input({ additions: { gypsum_g: 5 } }));
    expect(out.ca_ppm).toBeCloseTo(58.2, 1);
    expect(out.so4_ppm).toBeCloseTo(139.5, 1);
    // Other ions are untouched.
    expect(out.cl_ppm).toBe(0);
    expect(out.mg_ppm).toBe(0);
  });

  it("calcium chloride adds calcium AND chloride", () => {
    const out = computeWaterAdditions(
      input({ additions: { calcium_chloride_g: 5 } }),
    );
    // CaCl2·2H2O: Ca 0.2726, Cl 0.4823 → 5 g in 20 L
    expect(out.ca_ppm).toBeCloseTo(68.15, 1);
    expect(out.cl_ppm).toBeCloseTo(120.6, 1);
  });

  it("epsom salt adds magnesium AND sulfate", () => {
    const out = computeWaterAdditions(input({ additions: { epsom_g: 5 } }));
    expect(out.mg_ppm).toBeCloseTo(24.65, 1);
    expect(out.so4_ppm).toBeCloseTo(97.45, 1);
  });

  it("table salt adds sodium AND chloride", () => {
    const out = computeWaterAdditions(
      input({ additions: { table_salt_g: 2 } }),
    );
    expect(out.na_ppm).toBeCloseTo(39.34, 1);
    expect(out.cl_ppm).toBeCloseTo(60.66, 1);
  });

  it("baking soda adds sodium AND bicarbonate", () => {
    const out = computeWaterAdditions(
      input({ additions: { baking_soda_g: 5 } }),
    );
    expect(out.na_ppm).toBeCloseTo(68.4, 1);
    expect(out.hco3_ppm).toBeCloseTo(181.6, 1);
  });

  it("salts stack — multiple additions sum into the same ions", () => {
    const out = computeWaterAdditions(
      input({
        additions: { gypsum_g: 5, calcium_chloride_g: 5 },
      }),
    );
    // Calcium contributions from both salts add up.
    expect(out.ca_ppm).toBeCloseTo(58.2 + 68.15, 1);
    expect(out.so4_ppm).toBeCloseTo(139.5, 1);
    expect(out.cl_ppm).toBeCloseTo(120.6, 1);
  });

  it("source ions and addition contributions sum", () => {
    const out = computeWaterAdditions(
      input({
        source: { ...ZERO_IONS, ca_ppm: 30, so4_ppm: 20 },
        additions: { gypsum_g: 5 },
      }),
    );
    expect(out.ca_ppm).toBeCloseTo(30 + 58.2, 1);
    expect(out.so4_ppm).toBeCloseTo(20 + 139.5, 1);
  });

  it("doubles ppm contribution when the water volume halves", () => {
    const big = computeWaterAdditions(
      input({ water_volume_l: 20, additions: { gypsum_g: 5 } }),
    );
    const small = computeWaterAdditions(
      input({ water_volume_l: 10, additions: { gypsum_g: 5 } }),
    );
    expect(small.ca_ppm).toBeCloseTo(big.ca_ppm * 2, 1);
    expect(small.so4_ppm).toBeCloseTo(big.so4_ppm * 2, 1);
  });

  it("computes the SO4:Cl ratio", () => {
    const out = computeWaterAdditions(
      input({
        additions: { gypsum_g: 5, calcium_chloride_g: 5 },
      }),
    );
    // SO4 139.5 ÷ Cl 120.6 ≈ 1.16
    expect(out.so4_cl_ratio).toBeCloseTo(139.5 / 120.6, 2);
  });

  it("returns ratio 0 and flavor_hint 'none' when chloride is zero", () => {
    const out = computeWaterAdditions(input({ additions: { gypsum_g: 5 } }));
    expect(out.so4_cl_ratio).toBe(0);
    expect(out.flavor_hint).toBe("none");
  });

  it("maps the ratio to coarse flavor bands", () => {
    // Each row picks salt amounts to land the SO4:Cl ratio in a
    // specific band. Pre-computed ratios (in a 20 L volume):
    //   gypsum 0,  cacl2 10 → SO4 0    / Cl 241 → 0.00  very_malty
    //   gypsum 5,  cacl2 10 → SO4 140  / Cl 241 → 0.58  malty
    //   gypsum 5,  cacl2 5  → SO4 140  / Cl 121 → 1.16  balanced
    //   gypsum 10, cacl2 5  → SO4 279  / Cl 121 → 2.31  hoppy
    //   gypsum 20, cacl2 5  → SO4 558  / Cl 121 → 4.63  very_hoppy
    const cases: Array<{ gypsum: number; cacl2: number; hint: string }> = [
      { gypsum: 0, cacl2: 10, hint: "very_malty" },
      { gypsum: 5, cacl2: 10, hint: "malty" },
      { gypsum: 5, cacl2: 5, hint: "balanced" },
      { gypsum: 10, cacl2: 5, hint: "hoppy" },
      { gypsum: 20, cacl2: 5, hint: "very_hoppy" },
    ];
    for (const c of cases) {
      const out = computeWaterAdditions(
        input({
          additions: { gypsum_g: c.gypsum, calcium_chloride_g: c.cacl2 },
        }),
      );
      expect(out.flavor_hint).toBe(c.hint);
    }
  });
});
