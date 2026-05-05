import { describe, it, expect } from "vitest";
import { computeAbv } from "../src/abv.js";

describe("computeAbv", () => {
  it("matches the textbook simple formula", () => {
    // (1.054 − 1.012) × 131.25 = 5.5125
    expect(computeAbv(1.054, 1.012)).toBeCloseTo(5.51, 2);
  });

  it("returns 0 when OG equals FG", () => {
    expect(computeAbv(1.05, 1.05)).toBe(0);
  });

  it("scales linearly with the gravity drop", () => {
    expect(computeAbv(1.06, 1.01)).toBeCloseTo(50 * 0.13125, 4);
    expect(computeAbv(1.08, 1.01)).toBeCloseTo(70 * 0.13125, 4);
  });
});
