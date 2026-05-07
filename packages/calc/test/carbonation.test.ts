import { describe, it, expect } from "vitest";
import { computeCarbonation } from "../src/carbonation.js";

describe("computeCarbonation", () => {
  // Reference values come from Brewer's Friend's online priming calculator
  // and Northern Brewer's chart, both built on the Daniels residual-CO2
  // approximation and the standard sugar yields.
  it("matches a typical American Pale Ale priming run", () => {
    // 19 L beer fermented at 20 °C, target 2.4 vols → ~110 g corn sugar.
    const out = computeCarbonation({
      target_volumes_co2: 2.4,
      beer_volume_l: 19,
      package_temp_c: 20,
    });
    expect(out.residual_volumes_co2).toBeCloseTo(0.86, 1);
    expect(out.volumes_to_add).toBeCloseTo(1.54, 1);
    expect(out.priming.dextrose_g).toBeGreaterThan(100);
    expect(out.priming.dextrose_g).toBeLessThan(130);
  });

  it("dextrose / sucrose / DME ratios reflect their CO2 yields", () => {
    const out = computeCarbonation({
      target_volumes_co2: 2.5,
      beer_volume_l: 20,
      package_temp_c: 20,
    });
    // Sucrose has higher yield (0.51 vs 0.46) → less mass needed.
    expect(out.priming.sucrose_g).toBeLessThan(out.priming.dextrose_g);
    // DME has lower yield (0.34) → more mass needed.
    expect(out.priming.dme_g).toBeGreaterThan(out.priming.dextrose_g);
    // Approximate ratios: sucrose/dextrose ≈ 0.46/0.51 ≈ 0.90.
    expect(out.priming.sucrose_g / out.priming.dextrose_g).toBeCloseTo(
      0.46 / 0.51,
      2,
    );
    expect(out.priming.dme_g / out.priming.dextrose_g).toBeCloseTo(0.46 / 0.34, 2);
  });

  it("warmer package temp leaves less residual CO2 → needs more sugar", () => {
    const cold = computeCarbonation({
      target_volumes_co2: 2.4,
      beer_volume_l: 20,
      package_temp_c: 15,
    });
    const warm = computeCarbonation({
      target_volumes_co2: 2.4,
      beer_volume_l: 20,
      package_temp_c: 25,
    });
    expect(warm.residual_volumes_co2).toBeLessThan(cold.residual_volumes_co2);
    expect(warm.priming.dextrose_g).toBeGreaterThan(cold.priming.dextrose_g);
  });

  it("zero priming when residual already meets target", () => {
    // At 0 °C the beer holds ~1.7 vols natively. A target below that
    // means no priming is needed.
    const out = computeCarbonation({
      target_volumes_co2: 1.0,
      beer_volume_l: 20,
      package_temp_c: 5,
    });
    expect(out.volumes_to_add).toBeLessThan(0);
    expect(out.priming.dextrose_g).toBe(0);
    expect(out.priming.sucrose_g).toBe(0);
    expect(out.priming.dme_g).toBe(0);
  });

  it("force pressure increases with target volumes", () => {
    const lo = computeCarbonation({
      target_volumes_co2: 2.0,
      beer_volume_l: 19,
      package_temp_c: 20,
      serving_temp_c: 4,
    });
    const hi = computeCarbonation({
      target_volumes_co2: 3.0,
      beer_volume_l: 19,
      package_temp_c: 20,
      serving_temp_c: 4,
    });
    expect(hi.force_pressure_psi).toBeGreaterThan(lo.force_pressure_psi);
  });

  it("force pressure decreases with colder serving temp at fixed vols", () => {
    const cold = computeCarbonation({
      target_volumes_co2: 2.5,
      beer_volume_l: 19,
      package_temp_c: 20,
      serving_temp_c: 2,
    });
    const warm = computeCarbonation({
      target_volumes_co2: 2.5,
      beer_volume_l: 19,
      package_temp_c: 20,
      serving_temp_c: 12,
    });
    // Cold beer holds CO2 more easily → less pressure needed.
    expect(cold.force_pressure_psi).toBeLessThan(warm.force_pressure_psi);
  });

  it("typical kegerator setting falls in the homebrew sweet spot", () => {
    // 2.4 vols at 4 °C kegerator: industry rule of thumb ~10-12 PSI.
    const out = computeCarbonation({
      target_volumes_co2: 2.4,
      beer_volume_l: 19,
      package_temp_c: 4,
      serving_temp_c: 4,
    });
    expect(out.force_pressure_psi).toBeGreaterThan(8);
    expect(out.force_pressure_psi).toBeLessThan(14);
    expect(out.force_pressure_bar).toBeCloseTo(out.force_pressure_psi / 14.5038, 4);
  });

  it("priming scales linearly with batch volume", () => {
    const small = computeCarbonation({
      target_volumes_co2: 2.4,
      beer_volume_l: 10,
      package_temp_c: 20,
    });
    const big = computeCarbonation({
      target_volumes_co2: 2.4,
      beer_volume_l: 20,
      package_temp_c: 20,
    });
    expect(big.priming.dextrose_g).toBeCloseTo(small.priming.dextrose_g * 2, 2);
  });
});
