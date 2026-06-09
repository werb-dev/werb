import { describe, it, expect } from "vitest";
import { computeGrainBillPct } from "../src/grain-bill.js";

describe("computeGrainBillPct", () => {
  it("computes each fermentable's share by mass", () => {
    const out = computeGrainBillPct([
      { name: "Pilsner", mass_kg: 4 },
      { name: "Munich", mass_kg: 1 },
    ]);
    expect(out[0]).toEqual({ name: "Pilsner", pct: 80 });
    expect(out[1]).toEqual({ name: "Munich", pct: 20 });
  });

  it("sums to 100 across a three-grain bill", () => {
    const out = computeGrainBillPct([
      { name: "Pale", mass_kg: 7 },
      { name: "Wheat", mass_kg: 2 },
      { name: "Sugar", mass_kg: 1 },
    ]);
    const sum = out.reduce((s, f) => s + f.pct, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it("preserves input order so callers can zip by index", () => {
    const out = computeGrainBillPct([
      { name: "B", mass_kg: 1 },
      { name: "A", mass_kg: 3 },
    ]);
    expect(out.map((f) => f.name)).toEqual(["B", "A"]);
  });

  it("returns 0% for every row when the total mass is zero", () => {
    const out = computeGrainBillPct([
      { name: "X", mass_kg: 0 },
      { name: "Y", mass_kg: 0 },
    ]);
    expect(out.every((f) => f.pct === 0)).toBe(true);
  });

  it("handles an empty bill", () => {
    expect(computeGrainBillPct([])).toEqual([]);
  });
});
