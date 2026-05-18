import { describe, it, expect } from "vitest";
import { computeIbu } from "../src/ibu.js";

/**
 * Reference values cross-checked against Tinseth's published formula.
 * Recompute by hand if the implementation changes — these are not magic numbers.
 */
describe("computeIbu — Tinseth", () => {
  it("single 60-min addition matches the textbook example", () => {
    // 28 g Cascade @ 5.5% AA, 60 min, OG 1.050, 19 L batch.
    const out = computeIbu({
      og: 1.05,
      batch_size_l: 19,
      hops: [
        { name: "Cascade", amount_g: 28, alpha_acid_pct: 5.5, time_min: 60 },
      ],
    });

    expect(out.method).toBe("Tinseth");
    expect(out.additions).toHaveLength(1);
    // Hand-calculated: bigness=1.05256, tf=0.21910, util=0.23062, mg/L=81.053 → IBU≈18.69
    expect(out.total_ibu).toBeCloseTo(18.69, 1);
    expect(out.additions[0]!.utilization).toBeCloseTo(0.2306, 3);
  });

  it("flameout addition contributes zero IBU under standard Tinseth", () => {
    const out = computeIbu({
      og: 1.05,
      batch_size_l: 20,
      hops: [
        { amount_g: 30, alpha_acid_pct: 6, time_min: 0 },
      ],
    });
    expect(out.total_ibu).toBe(0);
    expect(out.additions[0]!.utilization).toBe(0);
  });

  it("sums multiple additions", () => {
    const out = computeIbu({
      og: 1.05,
      batch_size_l: 20,
      hops: [
        { name: "60m", amount_g: 25, alpha_acid_pct: 6, time_min: 60 },
        { name: "15m", amount_g: 25, alpha_acid_pct: 6, time_min: 15 },
        { name: "flameout", amount_g: 25, alpha_acid_pct: 6, time_min: 0 },
      ],
    });
    // 60m ≈ 17.30, 15m ≈ 8.58, flameout = 0 → ~25.88
    expect(out.total_ibu).toBeCloseTo(25.88, 1);
    expect(out.additions).toHaveLength(3);
    expect(out.additions[2]!.ibu).toBe(0);
  });

  it("higher OG reduces utilization (bigness factor)", () => {
    const lowOg = computeIbu({
      og: 1.04,
      batch_size_l: 20,
      hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
    });
    const highOg = computeIbu({
      og: 1.08,
      batch_size_l: 20,
      hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
    });
    expect(lowOg.total_ibu).toBeGreaterThan(highOg.total_ibu);
  });

  it("returns 0 IBU instead of Infinity when batch_size_l is 0", () => {
    const out = computeIbu({
      og: 1.05,
      batch_size_l: 0,
      hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
    });
    expect(out.total_ibu).toBe(0);
    expect(Number.isFinite(out.total_ibu)).toBe(true);
  });

  it("rejects unimplemented methods", () => {
    expect(() =>
      computeIbu({
        method: "Garetz",
        og: 1.05,
        batch_size_l: 20,
        hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
      }),
    ).toThrow(/not implemented/);
  });
});

describe("computeIbu — Rager", () => {
  it("60-min addition lands in the textbook range", () => {
    // 28 g @ 5.5% AA, 60 min, OG 1.050 (no gravity adjustment), 19 L.
    // Hand-check: tanh((60-31.32)/18.27) ≈ 0.928 → util ≈ 30.98%
    // mg/L = 0.055 × 28 × 1000 / 19 ≈ 81.05 → IBU ≈ 25.1
    const out = computeIbu({
      method: "Rager",
      og: 1.05,
      batch_size_l: 19,
      hops: [{ amount_g: 28, alpha_acid_pct: 5.5, time_min: 60 }],
    });
    expect(out.method).toBe("Rager");
    expect(out.total_ibu).toBeCloseTo(25.1, 0);
  });

  it("reads higher than Tinseth at 60 min, all else equal", () => {
    const tinseth = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
    });
    const rager = computeIbu({
      method: "Rager", og: 1.05, batch_size_l: 20,
      hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
    });
    expect(rager.total_ibu).toBeGreaterThan(tinseth.total_ibu);
  });

  it("applies the gravity adjustment past OG 1.050", () => {
    const at_1050 = computeIbu({
      method: "Rager", og: 1.05, batch_size_l: 20,
      hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
    });
    const at_1090 = computeIbu({
      method: "Rager", og: 1.09, batch_size_l: 20,
      hops: [{ amount_g: 30, alpha_acid_pct: 6, time_min: 60 }],
    });
    // GA at 1.090 = (0.09 - 0.05) / 0.2 = 0.2 → divide IBU by 1.2.
    expect(at_1090.total_ibu).toBeCloseTo(at_1050.total_ibu / 1.2, 1);
  });
});
