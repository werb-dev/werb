import { describe, it, expect } from "vitest";
import { computeGravity } from "../src/gravity.js";

describe("computeGravity", () => {
  it("textbook all-grain example: 5 kg @ 80% yield, 19 L, 75% efficiency → ~1.061", () => {
    const out = computeGravity({
      batch_size_l: 19,
      efficiency_pct: 75,
      fermentables: [
        { name: "Pale", mass_kg: 5, yield_pct: 80, category: "mashed" },
      ],
    });
    // 5 kg × 0.80 × 384 × 0.75 / 19 = 60.63 GU → OG 1.0606
    expect(out.gravity_units).toBeCloseTo(60.63, 1);
    expect(out.og).toBeCloseTo(1.0606, 3);
  });

  it("extract fermentables ignore brewhouse efficiency", () => {
    // 1 kg of pure sucrose (yield 100%) into 10 L should add 38.4 GU → 1.0384
    const out = computeGravity({
      batch_size_l: 10,
      efficiency_pct: 50, // intentionally low; should not apply to extract
      fermentables: [{ mass_kg: 1, yield_pct: 100, category: "extract" }],
    });
    expect(out.gravity_units).toBeCloseTo(38.4, 1);
    expect(out.og).toBeCloseTo(1.0384, 3);
  });

  it("returns OG 1.000 instead of Infinity when batch_size_l is 0", () => {
    // Schema rejects 0, but the editor lets the user type it. Guard
    // is in place to keep the rest of the Recipe screen rendering.
    const out = computeGravity({
      batch_size_l: 0,
      efficiency_pct: 75,
      fermentables: [{ mass_kg: 5, yield_pct: 80, category: "mashed" }],
    });
    expect(out.og).toBe(1);
    expect(out.gravity_units).toBe(0);
    expect(Number.isFinite(out.og)).toBe(true);
  });

  it("doubling efficiency doubles mashed contribution but not extract", () => {
    const low = computeGravity({
      batch_size_l: 20,
      efficiency_pct: 50,
      fermentables: [
        { mass_kg: 5, yield_pct: 80, category: "mashed" },
        { mass_kg: 0.5, yield_pct: 100, category: "extract" },
      ],
    });
    const high = computeGravity({
      batch_size_l: 20,
      efficiency_pct: 100,
      fermentables: [
        { mass_kg: 5, yield_pct: 80, category: "mashed" },
        { mass_kg: 0.5, yield_pct: 100, category: "extract" },
      ],
    });
    // mashed: 5×0.8×384 = 1536 GU·L → 76.8 / 153.6 GU/L
    // extract: 0.5×1.0×384 = 192 GU·L → 9.6 GU/L (unchanged)
    expect(low.gravity_units).toBeCloseTo(76.8 / 2 + 9.6, 2); // 50% × mashed
    expect(high.gravity_units).toBeCloseTo(76.8 + 9.6, 2);    // 100% × mashed
  });
});
