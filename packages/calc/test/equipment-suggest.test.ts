import { describe, it, expect } from "vitest";
import { computeEquipmentSuggest } from "../src/equipment-suggest.js";
import type { EquipmentSuggestInput } from "@werb/types";

function input(over: Partial<EquipmentSuggestInput> = {}): EquipmentSuggestInput {
  return {
    setup_type: "three_vessel",
    batch_size_l: 20,
    ...over,
  };
}

describe("computeEquipmentSuggest", () => {
  it("sizes a typical 20 L three-vessel rig", () => {
    // OG 1.060 default, 75 % efficiency, 60 min boil
    // - grain bill ≈ 5.2 kg, mash 14.5 L, sparge 14.0 L, pre-boil 24.4 L
    const out = computeEquipmentSuggest(input());

    expect(out.batch_size_l).toBe(20);
    expect(out.efficiency_pct).toBe(75);

    expect(out.derived.grain_kg).toBeCloseTo(5.2, 1);
    expect(out.derived.mash_water_l).toBeCloseTo(14.5, 1);
    expect(out.derived.sparge_water_l).toBeCloseTo(14.0, 1);
    expect(out.derived.pre_boil_volume_l).toBeCloseTo(24.4, 1);

    // HLT covers the larger of mash / sparge with 10 % headroom.
    // mash 14.5 L × 1.10 = 16.0006 → rounds up to 17.
    expect(out.hlt.capacity_l).toBe(17);
    expect(out.hlt.dead_space_l).toBe(1);

    // Mash tun ≈ (mash 14.5 + grain 3.4) × 1.15 → 21 L.
    expect(out.mash_tun.capacity_l).toBe(21);
    expect(out.mash_tun.grain_absorption_l_per_kg).toBe(0.8);

    // Kettle ≈ pre-boil 24.4 × 1.15 → 29 L.
    expect(out.kettle.capacity_l).toBe(29);
    expect(out.kettle.evaporation_rate_l_per_hour).toBe(3);
    expect(out.kettle.post_boil_shrinkage_pct).toBe(4);

    // Fermenter = 20 L × 1.25 → 25 L. Trub loss + transfer loss are
    // the project-wide defaults.
    expect(out.fermenter.capacity_l).toBe(25);
    expect(out.fermenter.trub_loss_l).toBe(0.5);
    expect(out.transfer_loss_l).toBe(0.5);
  });

  it("two-vessel: HLT is 0, kettle takes the max of sparge and pre-boil", () => {
    const out = computeEquipmentSuggest(input({ setup_type: "two_vessel" }));

    // No separate HLT — the kettle doubles up.
    expect(out.hlt.capacity_l).toBe(0);
    expect(out.hlt.dead_space_l).toBe(0);

    // Mash tun still present.
    expect(out.mash_tun.capacity_l).toBeGreaterThan(0);

    // For a 20 L / 1.060 brew, pre-boil > sparge so the kettle
    // constraint is the same as three-vessel: 29 L.
    expect(out.kettle.capacity_l).toBe(29);
  });

  it("BIAB: no HLT, no mash tun, kettle holds full-volume mash + grain", () => {
    const out = computeEquipmentSuggest(input({ setup_type: "biab" }));

    expect(out.hlt.capacity_l).toBe(0);
    expect(out.mash_tun.capacity_l).toBe(0);
    expect(out.mash_tun.dead_space_l).toBe(0);

    // Higher absorption rate since there's no sparge to recover from grain.
    expect(out.mash_tun.grain_absorption_l_per_kg).toBe(0.95);

    // Sparge is zero in BIAB — single full-volume mash.
    expect(out.derived.sparge_water_l).toBe(0);

    // BIAB kettle is much larger than three-vessel: it holds the full
    // mash water (~ pre-boil + absorbed) plus grain displacement, with
    // 15 % headroom. For 20 L / 1.060 that lands at 38 L.
    expect(out.kettle.capacity_l).toBe(38);
  });

  it("scales with batch size", () => {
    const small = computeEquipmentSuggest(input({ batch_size_l: 20 }));
    const big = computeEquipmentSuggest(input({ batch_size_l: 40 }));

    // All sized-up vessels should be strictly larger.
    expect(big.hlt.capacity_l).toBeGreaterThan(small.hlt.capacity_l);
    expect(big.mash_tun.capacity_l).toBeGreaterThan(small.mash_tun.capacity_l);
    expect(big.kettle.capacity_l).toBeGreaterThan(small.kettle.capacity_l);
    expect(big.fermenter.capacity_l).toBeGreaterThan(small.fermenter.capacity_l);

    // Doubling batch should roughly double grain (linear in batch × OG).
    expect(big.derived.grain_kg).toBeCloseTo(small.derived.grain_kg * 2, 1);
  });

  it("higher OG → larger grain bill → larger mash tun and HLT", () => {
    const session = computeEquipmentSuggest(input({ target_og: 1.06 }));
    const ipa = computeEquipmentSuggest(input({ target_og: 1.09 }));

    expect(ipa.derived.grain_kg).toBeGreaterThan(session.derived.grain_kg);
    expect(ipa.mash_tun.capacity_l).toBeGreaterThan(session.mash_tun.capacity_l);
    expect(ipa.hlt.capacity_l).toBeGreaterThan(session.hlt.capacity_l);

    // Kettle / fermenter depend on batch size, not OG — should be unchanged.
    expect(ipa.kettle.capacity_l).toBe(session.kettle.capacity_l);
    expect(ipa.fermenter.capacity_l).toBe(session.fermenter.capacity_l);
  });

  it("longer boil → larger kettle (more boil-off → bigger pre-boil)", () => {
    const sixty = computeEquipmentSuggest(input({ boil_time_min: 60 }));
    const ninety = computeEquipmentSuggest(input({ boil_time_min: 90 }));

    expect(ninety.derived.pre_boil_volume_l).toBeGreaterThan(
      sixty.derived.pre_boil_volume_l,
    );
    expect(ninety.kettle.capacity_l).toBeGreaterThanOrEqual(sixty.kettle.capacity_l);
  });

  it("lower efficiency → larger grain bill (same batch + OG)", () => {
    const standard = computeEquipmentSuggest(input({ efficiency_pct: 75 }));
    const poor = computeEquipmentSuggest(input({ efficiency_pct: 60 }));

    expect(poor.derived.grain_kg).toBeGreaterThan(standard.derived.grain_kg);
    expect(poor.efficiency_pct).toBe(60);
  });

  it("rounds capacities UP — we never undersize equipment", () => {
    // 19 L is awkward — pre-boil ~23.3 × 1.15 ≈ 26.8, must round up.
    const out = computeEquipmentSuggest(input({ batch_size_l: 19 }));
    expect(Number.isInteger(out.kettle.capacity_l)).toBe(true);
    expect(Number.isInteger(out.mash_tun.capacity_l)).toBe(true);
    expect(Number.isInteger(out.hlt.capacity_l)).toBe(true);
    expect(Number.isInteger(out.fermenter.capacity_l)).toBe(true);
  });

  it("uses input efficiency in the output, not the default", () => {
    const out = computeEquipmentSuggest(input({ efficiency_pct: 72 }));
    expect(out.efficiency_pct).toBe(72);
  });
});
