import { describe, it, expect } from "vitest";
import { computeYeastStarter } from "../src/yeast-starter.js";

describe("computeYeastStarter", () => {
  it("returns no starter when available already covers target", () => {
    const out = computeYeastStarter({
      available_cells_billion: 200,
      target_cells_billion: 200,
    });
    expect(out.starter_volume_l).toBe(0);
    expect(out.dme_g).toBe(0);
    expect(out.needs_step_up).toBe(false);
  });

  it("sizes a single-step stir-plate starter for a 2× growth target", () => {
    // 100 B → 200 B is well within one stir-plate step.
    const out = computeYeastStarter({
      available_cells_billion: 100,
      target_cells_billion: 200,
      aeration: "stir_plate",
    });
    expect(out.starter_volume_l).toBeGreaterThan(0.5);
    expect(out.starter_volume_l).toBeLessThan(4);
    expect(out.predicted_cells_billion).toBeGreaterThanOrEqual(200);
    expect(out.needs_step_up).toBe(false);
    expect(out.dme_g).toBe(Math.round(out.starter_volume_l * 100));
  });

  it("flags step-up when a single 4 L stir starter can't reach target", () => {
    // 20 B → 400 B is a 20× growth in one step — stir plate caps at 6×.
    const out = computeYeastStarter({
      available_cells_billion: 20,
      target_cells_billion: 400,
      aeration: "stir_plate",
    });
    expect(out.needs_step_up).toBe(true);
    expect(out.starter_volume_l).toBe(4);
    expect(out.predicted_cells_billion).toBeLessThan(400);
  });

  it("shake aeration needs more volume than stir plate for the same target", () => {
    const stir = computeYeastStarter({
      available_cells_billion: 100,
      target_cells_billion: 250,
      aeration: "stir_plate",
    });
    const shake = computeYeastStarter({
      available_cells_billion: 100,
      target_cells_billion: 250,
      aeration: "shake",
    });
    expect(shake.starter_volume_l).toBeGreaterThan(stir.starter_volume_l);
  });

  it("computes DME mass at 100 g/L", () => {
    const out = computeYeastStarter({
      available_cells_billion: 100,
      target_cells_billion: 180,
    });
    expect(out.dme_g).toBe(Math.round(out.starter_volume_l * 100));
  });

  it("handles zero available cells gracefully (no division by zero)", () => {
    const out = computeYeastStarter({
      available_cells_billion: 0,
      target_cells_billion: 100,
    });
    expect(out.starter_volume_l).toBe(0);
    expect(out.predicted_cells_billion).toBe(0);
  });
});
