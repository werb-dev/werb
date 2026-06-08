import { describe, it, expect } from "vitest";
import { computeBuGu } from "../src/bu-gu.js";

describe("computeBuGu", () => {
  it("balanced: 30 IBU at OG 1.060 → 0.5", () => {
    // GU = (1.060 − 1) × 1000 = 60 → 30 / 60 = 0.5
    expect(computeBuGu(30, 1.06)).toBeCloseTo(0.5, 3);
  });

  it("hoppy: 60 IBU at OG 1.060 → 1.0", () => {
    expect(computeBuGu(60, 1.06)).toBeCloseTo(1.0, 3);
  });

  it("returns 0 when gravity is at or below water (no divide-by-zero)", () => {
    expect(computeBuGu(40, 1.0)).toBe(0);
    expect(computeBuGu(40, 0.999)).toBe(0);
  });

  it("returns 0 for zero bitterness", () => {
    expect(computeBuGu(0, 1.05)).toBe(0);
  });
});
