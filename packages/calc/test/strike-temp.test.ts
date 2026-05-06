import { describe, it, expect } from "vitest";
import { computeStrikeTemp } from "../src/strike-temp.js";

describe("computeStrikeTemp", () => {
  it("matches Palmer's worked example (3 L/kg, 20°C grain → 67°C target)", () => {
    // T_strike = (0.41 / 3) × (67 − 20) + 67 = 6.42 + 67 = 73.42°C
    const out = computeStrikeTemp({
      mash_target_c: 67,
      grain_temp_c: 20,
      thickness_l_per_kg: 3,
    });
    expect(out.strike_temp_c).toBeCloseTo(73.42, 2);
  });

  it("thicker mash needs hotter strike water", () => {
    const thin = computeStrikeTemp({
      mash_target_c: 65,
      grain_temp_c: 20,
      thickness_l_per_kg: 4,
    });
    const thick = computeStrikeTemp({
      mash_target_c: 65,
      grain_temp_c: 20,
      thickness_l_per_kg: 1.5,
    });
    expect(thick.strike_temp_c).toBeGreaterThan(thin.strike_temp_c);
  });

  it("colder grain needs hotter strike water", () => {
    const warm = computeStrikeTemp({
      mash_target_c: 67,
      grain_temp_c: 22,
      thickness_l_per_kg: 3,
    });
    const cold = computeStrikeTemp({
      mash_target_c: 67,
      grain_temp_c: 10,
      thickness_l_per_kg: 3,
    });
    expect(cold.strike_temp_c).toBeGreaterThan(warm.strike_temp_c);
  });

  it("equal mash and grain temperatures need no boost", () => {
    const out = computeStrikeTemp({
      mash_target_c: 25,
      grain_temp_c: 25,
      thickness_l_per_kg: 3,
    });
    expect(out.strike_temp_c).toBe(25);
  });

  it("respects a custom specific-heat ratio", () => {
    const standard = computeStrikeTemp({
      mash_target_c: 67,
      grain_temp_c: 20,
      thickness_l_per_kg: 3,
    });
    const higher = computeStrikeTemp({
      mash_target_c: 67,
      grain_temp_c: 20,
      thickness_l_per_kg: 3,
      grain_specific_heat_ratio: 0.5,
    });
    // Higher ratio means grain pulls more heat → needs hotter strike water.
    expect(higher.strike_temp_c).toBeGreaterThan(standard.strike_temp_c);
  });

  it("echoes inputs unchanged", () => {
    const out = computeStrikeTemp({
      mash_target_c: 65,
      grain_temp_c: 18,
      thickness_l_per_kg: 2.5,
    });
    expect(out.mash_target_c).toBe(65);
    expect(out.grain_temp_c).toBe(18);
    expect(out.thickness_l_per_kg).toBe(2.5);
  });
});
