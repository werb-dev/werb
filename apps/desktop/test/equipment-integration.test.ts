import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { recipeToWaterInput } from "@werb/adapters";
import { computeWater } from "@werb/calc";
import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";
import { profileToWaterOverrides, type ProfileWithId } from "../src/data/equipment.ts";

/**
 * The active equipment profile reaches the calc through a three-step
 * chain: profileToWaterOverrides → recipeToWaterInput → computeWater.
 * Any link going stale (a new schema field added but not piped through,
 * a new override forgotten in the adapter) makes the override silently
 * inert. These tests pin the chain so the brewer's "dead space 2 L"
 * field always shows up in the strike volume.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE: BeerJsonFile = JSON.parse(
  readFileSync(join(__dirname, "../../../examples/double-ipa-mandarina.beerjson"), "utf8"),
) as BeerJsonFile;
const RECIPE: BeerJsonRecipe = FIXTURE.beerjson.recipes![0]!;

function profile(over: Partial<ProfileWithId> = {}): ProfileWithId {
  return {
    id: "test-rig",
    name: "Test rig",
    batch_size_l: 22,
    efficiency_pct: 75,
    ...over,
  };
}

describe("equipment profile → computeWater integration", () => {
  it("kettle dead space inflates the kettle / pre-boil volumes through the full chain", () => {
    const base = computeWater(recipeToWaterInput(RECIPE, profileToWaterOverrides(profile())));
    const withDead = computeWater(
      recipeToWaterInput(
        RECIPE,
        profileToWaterOverrides(profile({ kettle: { capacity_l: 50, dead_space_l: 1.5 } })),
      ),
    );
    expect(withDead.post_cool_kettle_volume_l - base.post_cool_kettle_volume_l).toBeCloseTo(1.5, 4);
  });

  it("mash-tun grain absorption override changes the sparge water", () => {
    const drier = computeWater(
      recipeToWaterInput(
        RECIPE,
        profileToWaterOverrides(
          profile({ mash_tun: { capacity_l: 35, grain_absorption_l_per_kg: 0.7 } }),
        ),
      ),
    );
    const wetter = computeWater(
      recipeToWaterInput(
        RECIPE,
        profileToWaterOverrides(
          profile({ mash_tun: { capacity_l: 35, grain_absorption_l_per_kg: 1.1 } }),
        ),
      ),
    );
    // More absorption → more sparge water needed to hit the same pre-boil.
    expect(wetter.sparge_water_l).toBeGreaterThan(drier.sparge_water_l);
  });

  it("BIAB mash_mode collapses mash + sparge into one full-volume mash", () => {
    const classic = computeWater(
      recipeToWaterInput(RECIPE, profileToWaterOverrides(profile({ mash_mode: "classic" }))),
    );
    const biab = computeWater(
      recipeToWaterInput(RECIPE, profileToWaterOverrides(profile({ mash_mode: "biab" }))),
    );
    expect(biab.sparge_water_l).toBe(0);
    expect(biab.mash_water_l).toBeGreaterThan(classic.mash_water_l);
    // Pre-boil is unchanged — same wort going into the kettle.
    expect(biab.pre_boil_volume_l).toBeCloseTo(classic.pre_boil_volume_l, 4);
  });

  it("single_vessel still sparges — classic water math, not BIAB (#47)", () => {
    const single = computeWater(
      recipeToWaterInput(RECIPE, profileToWaterOverrides(profile({ mash_mode: "single_vessel" }))),
    );
    const classic = computeWater(
      recipeToWaterInput(RECIPE, profileToWaterOverrides(profile({ mash_mode: "classic" }))),
    );
    // All-in-one keeps a real sparge, unlike BIAB which zeroes it.
    expect(single.sparge_water_l).toBeGreaterThan(0);
    expect(single.sparge_water_l).toBeCloseTo(classic.sparge_water_l, 4);
    expect(single.mash_water_l).toBeCloseTo(classic.mash_water_l, 4);
  });

  it("post_boil_shrinkage_l on the kettle overrides the percentage (#46)", () => {
    const out = computeWater(
      recipeToWaterInput(
        RECIPE,
        profileToWaterOverrides(
          profile({ kettle: { capacity_l: 50, post_boil_shrinkage_l: 1 } }),
        ),
      ),
    );
    expect(out.post_boil_volume_l).toBeCloseTo(out.post_cool_kettle_volume_l + 1, 4);
  });

  it("transfer_loss override propagates into post_cool_kettle_volume_l", () => {
    const lossy = computeWater(
      recipeToWaterInput(RECIPE, profileToWaterOverrides(profile({ transfer_loss_l: 1.5 }))),
    );
    const tight = computeWater(
      recipeToWaterInput(RECIPE, profileToWaterOverrides(profile({ transfer_loss_l: 0.2 }))),
    );
    expect(lossy.post_cool_kettle_volume_l - tight.post_cool_kettle_volume_l).toBeCloseTo(1.3, 4);
  });

  it("undefined profile passes no overrides — calc uses its built-in defaults", () => {
    const noProfile = computeWater(recipeToWaterInput(RECIPE, profileToWaterOverrides(undefined)));
    expect(Number.isFinite(noProfile.mash_water_l)).toBe(true);
    expect(noProfile.sparge_water_l).toBeGreaterThan(0);
  });
});
