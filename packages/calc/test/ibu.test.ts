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

describe("computeIbu — Malowicki (sub-boil)", () => {
  it("temperature_c >= 100 falls back to Tinseth", () => {
    // Explicit boiling temperature should match a no-temp boil hop
    // exactly — confirms the sub-boil path doesn't fire at 100 °C.
    const noTemp = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [{ amount_g: 28, alpha_acid_pct: 5.5, time_min: 60 }],
    });
    const atBoiling = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [
        { amount_g: 28, alpha_acid_pct: 5.5, time_min: 60, temperature_c: 100 },
      ],
    });
    expect(atBoiling.total_ibu).toBeCloseTo(noTemp.total_ibu, 3);
  });

  it("80 °C × 20 min lands in the documented hopstand range", () => {
    // 50 g @ 12% AA, 20 min hopstand at 80 °C, 20 L batch.
    // mg/L = 0.12 × 50 × 1000 / 20 = 300 ppm alpha.
    // Malowicki at 353.15 K:
    //   k1 ≈ 0.00205 /min, k2 ≈ 4.3e-4 /min, t = 20 →
    //   u_wort = (k1 / (k1 − k2)) · (exp(-k2·t) − exp(-k1·t)) ≈ 0.040
    // After 0.46 calibration: ~0.018 → IBU ≈ 5.5.
    // Brewing-tool references put a 50 g @ 12 % AA / 20 min / 80 °C
    // hopstand at ~5-10 IBU in a 20 L batch (mIBU ≈ 5, Brewfather
    // ≈ 8). We want to land in that band, not the ~0 IBU the
    // ((T-76.7)/23.3)² approximation gave.
    const out = computeIbu({
      og: 1.06, batch_size_l: 20,
      hops: [
        { amount_g: 50, alpha_acid_pct: 12, time_min: 20, temperature_c: 80 },
      ],
    });
    expect(out.total_ibu).toBeGreaterThan(3);
    expect(out.total_ibu).toBeLessThan(12);
  });

  it("colder hopstand bitters less than a hotter one", () => {
    // Same hop, same time — only temperature differs. Cooler =
    // fewer iso-alpha-acids formed = lower IBU.
    const base = { amount_g: 50, alpha_acid_pct: 12, time_min: 20 };
    const at90 = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [{ ...base, temperature_c: 90 }],
    });
    const at70 = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [{ ...base, temperature_c: 70 }],
    });
    expect(at90.total_ibu).toBeGreaterThan(at70.total_ibu);
  });

  it("longer hold time bitters more at the same temperature", () => {
    const base = { amount_g: 30, alpha_acid_pct: 8, temperature_c: 85 };
    const short = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [{ ...base, time_min: 10 }],
    });
    const long = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [{ ...base, time_min: 60 }],
    });
    expect(long.total_ibu).toBeGreaterThan(short.total_ibu);
  });

  it("very cold contact (<= 50 °C) contributes essentially nothing", () => {
    // At 50 °C, k1 ≈ 4.4 × 10⁻⁴ /min — utilisation over 30 min is
    // ~0.014 of alpha, × 0.255 calibration → ~1 IBU even for a
    // serious hop dose.
    const out = computeIbu({
      og: 1.05, batch_size_l: 20,
      hops: [
        { amount_g: 80, alpha_acid_pct: 12, time_min: 30, temperature_c: 50 },
      ],
    });
    expect(out.total_ibu).toBeLessThan(3);
  });
});
