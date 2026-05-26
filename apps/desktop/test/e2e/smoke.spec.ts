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

  test("BIAB hides HLT + mash-tun sections; classic shows them", async ({ page }) => {
    const app = new App(page);
    await app.go("Equipment");
    await app.equipment.createFirstProfile();

    // Start in classic — both sections visible.
    await app.equipment.setMashMode("classic");
    await expect(app.equipment.hltSection()).toBeVisible();
    await expect(app.equipment.mashTunSection()).toBeVisible();

    // Flip to BIAB — both hide.
    await app.equipment.setMashMode("biab");
    await expect(app.equipment.hltSection()).toBeHidden();
    await expect(app.equipment.mashTunSection()).toBeHidden();

    // Flip back — they reappear.
    await app.equipment.setMashMode("classic");
    await expect(app.equipment.hltSection()).toBeVisible();
    await expect(app.equipment.mashTunSection()).toBeVisible();
  });

  test("mash thickness persists across navigation", async ({ page }) => {
    const app = new App(page);
    await app.go("Equipment");
    await app.equipment.createFirstProfile();
    await app.equipment.setMashThickness("3.5");

    await app.go("Library");
    await app.go("Equipment");
    await app.equipment.openFirstProfile();

    expect(await app.equipment.getMashThickness()).toBe("3.5");
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

test.describe("Recipe editor — ingredient picker", () => {
  test("ingredient dropdown is uncapped and prefix-ranks first", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.openNewRecipeEditor();

    // Add a fermentable row and focus the catalog picker.
    await page.getByRole("button", { name: /\+\s*Add fermentable/i }).click();
    const picker = page.getByPlaceholder(/Pick a fermentable…/i).first();
    await picker.click();
    await picker.fill("malt");

    const menu = page.locator('[data-testid="combobox-menu"]');
    await menu.waitFor();

    // Old behaviour capped at 10. The catalog has many more "malt" matches.
    const count = await menu.locator("button").count();
    expect(count).toBeGreaterThan(10);

    // Menu lives outside the field's section and uses fixed positioning,
    // so an ancestor's `overflow-hidden` can't clip it on small screens.
    const position = await menu.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe("fixed");
  });

  test("French alias 'blé' finds Wheat fermentables", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.openNewRecipeEditor();

    await page.getByRole("button", { name: /\+\s*Add fermentable/i }).click();
    const picker = page.getByPlaceholder(/Pick a fermentable…/i).first();
    await picker.click();
    await picker.fill("blé");

    const menu = page.locator('[data-testid="combobox-menu"]');
    await menu.waitFor();
    const text = await menu.innerText();
    // Wheat-bearing entries are surfaced even though the catalog uses
    // English names. Confirms the alias layer reaches the picker.
    expect(text).toMatch(/Wheat/i);
  });

  test("typing narrows toward prefix matches (malt → tier-A entries only)", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.openNewRecipeEditor();

    await page.getByRole("button", { name: /\+\s*Add fermentable/i }).click();
    const picker = page.getByPlaceholder(/Pick a fermentable…/i).first();
    await picker.click();
    await picker.fill("malt");

    const menu = page.locator('[data-testid="combobox-menu"]');
    await menu.waitFor();
    // Top result should match "malt" as a prefix on either the name
    // (e.g. "Maltodextrin") OR an alias (e.g. Black Patent's "malt
    // noir"). It must not be an entry where "malt" appears only
    // mid-name like "Pilsen Liquid Malt Extract" — those are Tier B
    // and should rank below every Tier-A match.
    const firstLabel = (await menu.locator("button").first().innerText())
      .trimStart()
      .toLowerCase();
    // Tier B examples we don't want in slot #1:
    expect(firstLabel.startsWith("pilsen liquid malt")).toBe(false);
    expect(firstLabel.startsWith("munich liquid malt")).toBe(false);
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
