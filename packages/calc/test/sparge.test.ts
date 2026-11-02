import { describe, it, expect } from "vitest";
import { computeSparge } from "../src/sparge.js";

// Wild Hop SMaSH: 1.3 kg grain mashed at 67 °C, 7.4 L of sparge water.
const smash = {
  sparge_water_l: 7.4,
  grain_kg: 1.3,
  mash_temp_c: 67,
} as const;

describe("computeSparge", () => {
  it("fly sparge: one run at the target bed temperature", () => {
    const out = computeSparge({ ...smash, method: "fly" });
    expect(out.runs).toBe(1);
    expect(out.run_volume_l).toBeCloseTo(7.4, 6);
    expect(out.water_temp_c).toBe(75);
  });

  it("batch sparge: one run hot enough to lift the bed to 75 °C", () => {
    // Bed = 0.41 × 1.3 + 1.3 × 0.96 = 1.781 L-equivalent, 8 °C to gain.
    // T = 75 + 1.781 × 8 / 7.4 = 76.93 °C
    const out = computeSparge({ ...smash, method: "batch" });
    expect(out.runs).toBe(1);
    expect(out.water_temp_c).toBeCloseTo(76.93, 2);
    expect(out.next_runs_water_temp_c).toBe(75);
  });

  it("batch sparge: a small mash tun splits the water into equal runs", () => {
    // Room per run: 8 − 1.248 absorbed − 0.871 grain = 5.88 L → 2 runs of 3.7 L.
    const out = computeSparge({ ...smash, method: "batch", mash_tun_capacity_l: 8 });
    expect(out.runs).toBe(2);
    expect(out.run_volume_l).toBeCloseTo(3.7, 6);
    // Smaller first run has to be hotter: 75 + 1.781 × 8 / 3.7 = 78.85 °C
    expect(out.water_temp_c).toBeCloseTo(78.85, 2);
  });

  it("batch sparge: a run that exactly fits stays one run", () => {
    const room = 1.3 * 0.96 + 1.3 * 0.67;
    const out = computeSparge({
      ...smash,
      method: "batch",
      mash_tun_capacity_l: 7.4 + room,
    });
    expect(out.runs).toBe(1);
  });

  it("dead space counts as bed to heat and as lost room", () => {
    const dry = computeSparge({ ...smash, method: "batch" });
    const wet = computeSparge({ ...smash, method: "batch", mash_dead_space_l: 1 });
    expect(wet.water_temp_c).toBeGreaterThan(dry.water_temp_c);
  });

  it("a bed already at the target takes water at the target", () => {
    const out = computeSparge({ ...smash, method: "batch", mash_temp_c: 75 });
    expect(out.water_temp_c).toBeCloseTo(75, 6);
  });

  it("caps the water temperature below boiling", () => {
    const out = computeSparge({ ...smash, method: "batch", sparge_water_l: 0.2 });
    expect(out.water_temp_c).toBe(95);
  });

  it("no sparge water: zero runs", () => {
    const out = computeSparge({ ...smash, method: "batch", sparge_water_l: 0 });
    expect(out.runs).toBe(0);
    expect(out.run_volume_l).toBe(0);
  });

  it("a tun too small for the bed falls back to one run", () => {
    const out = computeSparge({ ...smash, method: "batch", mash_tun_capacity_l: 1 });
    expect(out.runs).toBe(1);
  });
});
