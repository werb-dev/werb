import { expect, test } from "@playwright/test";
import { App } from "./pages.js";

/**
 * Behavioral smoke suite. Drives the production bundle (`vite preview`)
 * through interaction paths that unit tests can't reach — stale-closure
 * persistence, cross-section state coupling, message-text gating.
 *
 * Each test starts from a wiped localStorage so order doesn't matter.
 */

test.beforeEach(async ({ page }) => {
  const app = new App(page);
  await app.start();
});

test.describe("Equipment — BIAB mash mode", () => {
  test("persists across navigation", async ({ page }) => {
    const app = new App(page);
    await app.go("Equipment");
    await app.equipment.createFirstProfile();
    await app.equipment.setMashMode("biab");

    await app.go("Library");
    await app.go("Equipment");
    await app.equipment.openFirstProfile();

    expect(await app.equipment.getMashMode()).toBe("biab");
  });

  test("Quick start BIAB layout auto-sets mash_mode", async ({ page }) => {
    const app = new App(page);
    await app.go("Equipment");
    await app.equipment.createFirstProfile();
    await app.equipment.setMashMode("classic");

    await app.equipment.openQuickStart();
    await app.equipment.pickSetupType("biab");
    await app.equipment.applyQuickStart();

    expect(await app.equipment.getMashMode()).toBe("biab");
  });

  test("Quick start 3-vessel layout auto-sets mash_mode to classic", async ({ page }) => {
    // Symmetric branch: the fix isn't BIAB-only.
    const app = new App(page);
    await app.go("Equipment");
    await app.equipment.createFirstProfile();
    await app.equipment.setMashMode("biab");

    await app.equipment.openQuickStart();
    await app.equipment.pickSetupType("three_vessel");
    await app.equipment.applyQuickStart();

    expect(await app.equipment.getMashMode()).toBe("classic");
  });

  test("active BIAB profile → recipe shows zero sparge", async ({ page }) => {
    const app = new App(page);
    await app.go("Equipment");
    await app.equipment.createFirstProfile();
    await app.equipment.openQuickStart();
    await app.equipment.pickSetupType("biab");
    await app.equipment.applyQuickStart();
    await app.equipment.setActive();

    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();

    const sparge = await app.recipe.spargeText();
    // The sparge tile renders "SPARGE\n0.0 L". Match the number on its own line.
    expect(sparge).toMatch(/0(\.0)?\s*L/);
  });
});

test.describe("Water chemistry — source = target reports no delta", () => {
  test("Burton on both sides reports a match", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();

    await app.recipe.setWaterSource("burton");
    await app.recipe.setWaterTarget("burton");

    expect(await app.recipe.offTargetIonCount()).toBe(0);
  });

  test("Munich on both sides reports a match", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();

    await app.recipe.setWaterSource("munich");
    await app.recipe.setWaterTarget("munich");

    expect(await app.recipe.offTargetIonCount()).toBe(0);
  });

  test("real mismatch still flags deltas (Burton vs Pilsner)", async ({ page }) => {
    // Guard against the city-targets fix over-collapsing comparisons.
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();

    await app.recipe.setWaterSource("burton");
    await app.recipe.setWaterTarget("pilsner");

    expect(await app.recipe.offTargetIonCount()).toBeGreaterThanOrEqual(3);
  });
});

test.describe("Yeast pitch — message gating", () => {
  test("recipe with no fermentables names the missing input", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.newEmptyRecipe("Smoke Empty");

    const text = await app.recipe.yeastText();
    expect(text).toMatch(/Can't compute pitch rate yet/i);
    expect(text).toMatch(/fermentables/i);
    // Old misleading message must not resurface.
    expect(text).not.toMatch(/Set an original gravity/i);
  });

  test("seeded recipe with grain bill computes pitch numbers", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();

    const text = await app.recipe.yeastText();
    expect(text).toMatch(/TARGET|RECOMMENDED|PER PACK/i);
    expect(text).not.toMatch(/Can't compute pitch rate|Set an original gravity/i);
  });
});
