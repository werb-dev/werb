import { describe, it, expect } from "vitest";
import { solveGrainToOg, solveHopsToIbu } from "../src/solve.js";

describe("solveGrainToOg", () => {
  it("scaling the bill by the factor moves OG to target (points are linear in mass)", () => {
    // Current OG 1.040 (40 points), target 1.060 (60 points) → factor 1.5
    const factor = solveGrainToOg(1.04, 1.06);
    expect(factor).toBeCloseTo(1.5, 6);
    // Applying the factor to the points reproduces the target OG.
    const newPoints = (1.04 - 1) * 1000 * factor;
    expect(1 + newPoints / 1000).toBeCloseTo(1.06, 6);
  });

  it("factor below 1 when the target is lower than current", () => {
    expect(solveGrainToOg(1.06, 1.045)).toBeCloseTo(0.75, 6);
  });

  it("returns 1 (no-op) when current gravity has no points to scale", () => {
    expect(solveGrainToOg(1.0, 1.05)).toBe(1);
  });

  it("returns 1 for a non-positive target", () => {
    expect(solveGrainToOg(1.05, 1.0)).toBe(1);
  });
});

describe("solveHopsToIbu", () => {
  it("scales hop mass linearly to the IBU target", () => {
    expect(solveHopsToIbu(20, 50)).toBeCloseTo(2.5, 6);
    expect(solveHopsToIbu(60, 30)).toBeCloseTo(0.5, 6);
  });

  it("returns 1 when there is no current bitterness to scale", () => {
    expect(solveHopsToIbu(0, 40)).toBe(1);
  });

  it("supports a zero target (strip the bitterness)", () => {
    expect(solveHopsToIbu(40, 0)).toBe(0);
  });
});
