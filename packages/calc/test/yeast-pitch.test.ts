import { describe, it, expect } from "vitest";
import { computeYeastPitch } from "../src/yeast-pitch.js";

describe("computeYeastPitch", () => {
  // Reference: a typical American pale ale — 19 L into the fermenter,
  // OG 1.052, ale style. Mr. Malty / homebrew rule of thumb wants
  // ~180 B viable cells. A single fresh liquid pack (100 B × 0.80
  // viability = 80 B) doesn't cut it; a single fresh dry sachet
  // (200 B × 0.97 = 194 B) covers it.
  it("matches the canonical American pale ale pitch", () => {
    const out = computeYeastPitch({
      og_sg: 1.052,
      beer_volume_l: 19,
      style_type: "ale",
      yeast_form: "liquid",
    });
    expect(out.og_plato).toBeCloseTo(12.86, 1);
    expect(out.target_rate_m_per_ml_per_plato).toBe(0.75);
    expect(out.target_cells_billion).toBeGreaterThan(170);
    expect(out.target_cells_billion).toBeLessThan(200);
  });

  it("lagers pitch at twice the rate of ales", () => {
    const ale = computeYeastPitch({
      og_sg: 1.05,
      beer_volume_l: 20,
      style_type: "ale",
      yeast_form: "dry",
    });
    const lager = computeYeastPitch({
      og_sg: 1.05,
      beer_volume_l: 20,
      style_type: "lager",
      yeast_form: "dry",
    });
    expect(lager.target_cells_billion).toBeCloseTo(ale.target_cells_billion * 2, 1);
  });

  it("high-gravity ales bump the rate to 1.0", () => {
    const out = computeYeastPitch({
      og_sg: 1.085,
      beer_volume_l: 20,
      style_type: "high_gravity",
      yeast_form: "liquid",
    });
    expect(out.target_rate_m_per_ml_per_plato).toBe(1.0);
  });

  it("dry yeast defaults to 200 B per 11.5 g pack at 97% viability", () => {
    const out = computeYeastPitch({
      og_sg: 1.05,
      beer_volume_l: 20,
      style_type: "ale",
      yeast_form: "dry",
    });
    expect(out.cells_per_pack_effective_billion).toBeCloseTo(200 * 0.97, 1);
  });

  it("liquid yeast defaults to 100 B per pack at 80% viability", () => {
    const out = computeYeastPitch({
      og_sg: 1.05,
      beer_volume_l: 20,
      style_type: "ale",
      yeast_form: "liquid",
    });
    expect(out.cells_per_pack_effective_billion).toBeCloseTo(80, 1);
  });

  it("respects custom pack size and viability overrides", () => {
    const out = computeYeastPitch({
      og_sg: 1.05,
      beer_volume_l: 20,
      style_type: "ale",
      yeast_form: "liquid",
      cells_per_pack_billion: 150, // hypothetical bigger slurry
      viability_pct: 90,
    });
    expect(out.cells_per_pack_effective_billion).toBeCloseTo(150 * 0.9, 1);
  });

  it("flags has_sufficient and zero shortfall when packs cover the target", () => {
    const out = computeYeastPitch({
      og_sg: 1.045,
      beer_volume_l: 19,
      style_type: "ale",
      yeast_form: "dry",
      yeast_pack_count: 2, // ample for a normal-gravity ale
    });
    expect(out.has_sufficient).toBe(true);
    expect(out.shortfall_billion_cells).toBe(0);
  });

  it("flags shortfall when packs fall short", () => {
    const out = computeYeastPitch({
      og_sg: 1.085, // big beer
      beer_volume_l: 20,
      style_type: "high_gravity",
      yeast_form: "liquid",
      yeast_pack_count: 1, // not enough
    });
    expect(out.has_sufficient).toBe(false);
    expect(out.shortfall_billion_cells).toBeGreaterThan(0);
  });

  it("recommended_pack_count is the ceiling of packs_needed", () => {
    const out = computeYeastPitch({
      og_sg: 1.052,
      beer_volume_l: 19,
      style_type: "ale",
      yeast_form: "liquid",
    });
    expect(out.recommended_pack_count).toBe(Math.ceil(out.packs_needed));
  });

  it("packs_needed scales linearly with beer volume", () => {
    const small = computeYeastPitch({
      og_sg: 1.05,
      beer_volume_l: 10,
      style_type: "ale",
      yeast_form: "dry",
    });
    const big = computeYeastPitch({
      og_sg: 1.05,
      beer_volume_l: 20,
      style_type: "ale",
      yeast_form: "dry",
    });
    expect(big.packs_needed).toBeCloseTo(small.packs_needed * 2, 2);
  });

  it("packs_needed scales linearly with gravity (as °P)", () => {
    const a = computeYeastPitch({
      og_sg: 1.04,
      beer_volume_l: 20,
      style_type: "ale",
      yeast_form: "dry",
    });
    const b = computeYeastPitch({
      og_sg: 1.06,
      beer_volume_l: 20,
      style_type: "ale",
      yeast_form: "dry",
    });
    // ratio should equal °P ratio.
    expect(b.target_cells_billion / a.target_cells_billion).toBeCloseTo(
      b.og_plato / a.og_plato,
      2,
    );
  });
});
