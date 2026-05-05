import { describe, it, expect } from "vitest";
import { computeWater } from "../src/water.js";

/**
 * Reference values hand-computed against the model documented in water.ts.
 * If the implementation changes, recompute by hand — these are not magic numbers.
 */
describe("computeWater", () => {
  it("standard 20L IPA brew with default losses", () => {
    // 5 kg grain, 60-min boil, 3.0 L/kg mash thickness, all losses at default.
    const out = computeWater({
      batch_size_l: 20,
      total_grain_kg: 5,
      boil_time_min: 60,
      mash_thickness_l_per_kg: 3.0,
    });

    expect(out.mash_water_l).toBe(15);
    expect(out.grain_absorption_l).toBeCloseTo(4.8, 4);
    expect(out.boil_off_l).toBeCloseTo(3, 4);
    expect(out.post_cool_kettle_volume_l).toBeCloseTo(20.5, 4);
    expect(out.post_boil_volume_l).toBeCloseTo(21.354, 2);
    expect(out.pre_boil_volume_l).toBeCloseTo(24.354, 2);
    expect(out.sparge_water_l).toBeCloseTo(14.154, 2);
    expect(out.total_water_l).toBeCloseTo(29.154, 2);
  });

  it("longer boil increases pre-boil volume by exactly the extra boil-off", () => {
    const base = { batch_size_l: 20, total_grain_kg: 5, mash_thickness_l_per_kg: 3.0 };
    const sixty = computeWater({ ...base, boil_time_min: 60 });
    const ninety = computeWater({ ...base, boil_time_min: 90 });

    // 30 extra minutes at 3 L/h = 1.5 L extra boil-off; everything downstream constant.
    expect(ninety.boil_off_l - sixty.boil_off_l).toBeCloseTo(1.5, 4);
    expect(ninety.pre_boil_volume_l - sixty.pre_boil_volume_l).toBeCloseTo(1.5, 4);
    expect(ninety.sparge_water_l - sixty.sparge_water_l).toBeCloseTo(1.5, 4);
    expect(ninety.post_boil_volume_l).toBeCloseTo(sixty.post_boil_volume_l, 4);
  });

  it("kettle dead space inflates volumes by exactly that amount at the kettle stage", () => {
    const base = {
      batch_size_l: 20,
      total_grain_kg: 5,
      boil_time_min: 60,
      mash_thickness_l_per_kg: 3.0,
    };
    const noDead = computeWater({ ...base, kettle_dead_space_l: 0 });
    const withDead = computeWater({ ...base, kettle_dead_space_l: 1 });

    expect(withDead.post_cool_kettle_volume_l - noDead.post_cool_kettle_volume_l).toBeCloseTo(1, 4);
    // Hot volume difference = 1 / (1 - 0.04) = 1.0417 L
    expect(withDead.post_boil_volume_l - noDead.post_boil_volume_l).toBeCloseTo(1 / 0.96, 3);
  });

  it("returns a negative sparge_water_l when mash thickness is too high to reach pre-boil", () => {
    const out = computeWater({
      batch_size_l: 20,
      total_grain_kg: 5,
      boil_time_min: 60,
      mash_thickness_l_per_kg: 6.0, // 30 L mash water — already past pre-boil before sparge
    });
    expect(out.mash_water_l).toBe(30);
    expect(out.sparge_water_l).toBeLessThan(0);
    // total_water_l clamps the negative sparge to 0
    expect(out.total_water_l).toBe(out.mash_water_l);
  });

  it("zero boil time means zero boil-off but still computes the rest", () => {
    const out = computeWater({
      batch_size_l: 20,
      total_grain_kg: 5,
      boil_time_min: 0,
      mash_thickness_l_per_kg: 3.0,
    });
    expect(out.boil_off_l).toBe(0);
    expect(out.pre_boil_volume_l).toBeCloseTo(out.post_boil_volume_l, 4);
  });
});
