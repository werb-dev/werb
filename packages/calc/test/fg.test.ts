import { describe, it, expect } from "vitest";
import { computeFg } from "../src/fg.js";

describe("computeFg", () => {
  it("uses apparent attenuation to drop OG", () => {
    // OG 1.054, atten 75% → FG ≈ 1.0135
    expect(computeFg(1.054, 75)).toBeCloseTo(1.0135, 4);
  });

  it("returns OG when attenuation is 0", () => {
    expect(computeFg(1.05, 0)).toBe(1.05);
  });

  it("scales with attenuation linearly", () => {
    expect(computeFg(1.06, 80)).toBeCloseTo(1.012, 4);
    expect(computeFg(1.06, 70)).toBeCloseTo(1.018, 4);
    expect(computeFg(1.06, 100)).toBeCloseTo(1.0, 4);
  });
});
