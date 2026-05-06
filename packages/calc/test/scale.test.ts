import { describe, it, expect } from "vitest";
import { computeScale } from "../src/scale.js";

describe("computeScale", () => {
  it("identity factors when from and to are equal", () => {
    const out = computeScale({
      from_batch_size_l: 20,
      to_batch_size_l: 20,
      from_efficiency_pct: 75,
      to_efficiency_pct: 75,
    });
    expect(out.volume_factor).toBe(1);
    expect(out.fermentable_factor).toBe(1);
  });

  it("scales linearly with batch size when efficiency is unchanged", () => {
    const out = computeScale({
      from_batch_size_l: 20,
      to_batch_size_l: 25,
      from_efficiency_pct: 75,
      to_efficiency_pct: 75,
    });
    expect(out.volume_factor).toBeCloseTo(1.25, 6);
    expect(out.fermentable_factor).toBeCloseTo(1.25, 6);
  });

  it("compensates fermentables when target efficiency is lower", () => {
    // Smaller efficiency → need more grain to hit the same OG.
    const out = computeScale({
      from_batch_size_l: 20,
      to_batch_size_l: 20,
      from_efficiency_pct: 80,
      to_efficiency_pct: 70,
    });
    expect(out.volume_factor).toBe(1);
    expect(out.fermentable_factor).toBeCloseTo(80 / 70, 6);
  });

  it("compensates fermentables when target efficiency is higher", () => {
    // Higher efficiency → need less grain.
    const out = computeScale({
      from_batch_size_l: 20,
      to_batch_size_l: 20,
      from_efficiency_pct: 70,
      to_efficiency_pct: 80,
    });
    expect(out.fermentable_factor).toBeCloseTo(70 / 80, 6);
  });

  it("combines volume and efficiency adjustments multiplicatively", () => {
    const out = computeScale({
      from_batch_size_l: 20,
      to_batch_size_l: 25,
      from_efficiency_pct: 80,
      to_efficiency_pct: 75,
    });
    expect(out.volume_factor).toBeCloseTo(1.25, 6);
    expect(out.fermentable_factor).toBeCloseTo(1.25 * (80 / 75), 6);
  });

  it("echoes the target back unchanged", () => {
    const out = computeScale({
      from_batch_size_l: 19,
      to_batch_size_l: 23,
      from_efficiency_pct: 72,
      to_efficiency_pct: 78,
    });
    expect(out.to_batch_size_l).toBe(23);
    expect(out.to_efficiency_pct).toBe(78);
  });
});
