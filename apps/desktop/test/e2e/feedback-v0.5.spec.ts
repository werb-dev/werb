import { expect, test } from "@playwright/test";
import { App } from "./pages.js";

/**
 * Behavioral smokes for the v0.5.0 forum-feedback batch: editor
 * retargeting (scale / solve), the unsaved-changes guard, water salt
 * suggestion, and the BU:GU tile. Drives the production bundle like the
 * main smoke suite; each test starts from a wiped localStorage.
 */

test.beforeEach(async ({ page }) => {
  const app = new App(page);
  await app.start();
});

/** Pull the leading specific-gravity / number out of a tile's text. */
function num(text: string): number {
  return parseFloat(text.replace(/[^0-9.]/g, ""));
}

test.describe("Recipe editor — unsaved-changes guard (#35)", () => {
  test("dismissing the confirm keeps you in the editor; accepting leaves", async ({
    page,
  }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();
    await app.recipe.edit();

    // Make the draft dirty.
    await app.recipe.nameField().fill("Edited name that is unsaved");

    // Default Playwright behavior auto-dismisses the dialog → confirm()
    // returns false → the guard blocks navigation, so we stay put.
    await app.recipe.clickCancel();
    await expect(page.locator('[data-testid="editor-targets-banner"]')).toBeVisible();

    // Now accept the discard prompt → navigation goes through.
    page.once("dialog", (d) => d.accept());
    await app.recipe.clickCancel();
    await page.waitForSelector('[data-testid="water-volumes"]', { timeout: 10_000 });
  });

  test("no prompt when nothing changed", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();
    await app.recipe.edit();

    // Clean draft → cancel should leave immediately, no dialog to handle.
    let dialogFired = false;
    page.on("dialog", (d) => {
      dialogFired = true;
      void d.accept();
    });
    await app.recipe.clickCancel();
    await page.waitForSelector('[data-testid="water-volumes"]', { timeout: 10_000 });
    expect(dialogFired).toBe(false);
  });
});

test.describe("Recipe editor — retargeting tools (#33)", () => {
  test("scale to a new volume preserves OG and updates the batch size", async ({
    page,
  }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();
    await app.recipe.edit();

    const ogBefore = num(await app.recipe.editorOgText());
    expect(ogBefore).toBeGreaterThan(1.0); // recipe actually has a grain bill

    await app.recipe.scaleToVolume("37");

    // Batch size retargeted…
    expect(await app.recipe.batchSizeValue()).toContain("37");
    // …but the gravity envelope is preserved (proportional scale).
    const ogAfter = num(await app.recipe.editorOgText());
    expect(Math.abs(ogAfter - ogBefore)).toBeLessThan(0.002);
  });

  test("solve to a target IBU moves the IBU tile to that number", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    // Cascade Pale Ale carries boil hops, so IBU is non-zero and scalable.
    await app.library.openRecipeByName("Cascade Pale Ale");
    await app.recipe.edit();

    await app.recipe.solveToIbu("42");

    const ibuAfter = num(await app.recipe.editorIbuText());
    expect(Math.abs(ibuAfter - 42)).toBeLessThanOrEqual(1);
  });
});

test.describe("Style fit — view and editor agree", () => {
  test("the level bars sit at the same spot in view mode and edit mode", async ({
    page,
  }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openRecipeByName("Cascade Pale Ale");

    // Snapshot every style-fit gauge (fit colour + needle position).
    const gauges = () =>
      page.locator('[data-testid="style-gauge"]').evaluateAll((els) =>
        els.map((el) => ({
          status: el.getAttribute("data-status"),
          left: (el.querySelector("div[style]") as HTMLElement | null)?.style.left,
        })),
      );

    const viewGauges = await gauges();
    expect(viewGauges.length).toBeGreaterThanOrEqual(4);

    await app.recipe.edit();
    const editorGauges = await gauges();

    // Same recipe, same fit basis (computed) → identical bars. This is the
    // regression guard: the read view used to feed the gauge the file's
    // claimed values while the editor used the live compute, so the needles
    // jumped when you toggled edit mode.
    expect(editorGauges).toEqual(viewGauges);
  });
});

test.describe("Mash schedule — live strike-water temperature", () => {
  test("the editor shows a computed strike temp for the mash-in step", async ({
    page,
  }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    // West Coast IPA ships a stepped mash whose first step targets 63 °C.
    await app.library.openRecipeByName("West Coast IPA");
    await app.recipe.edit();

    const hint = page.locator('[data-testid="strike-temp-hint"]');
    await hint.scrollIntoViewIfNeeded();
    await hint.waitFor();
    const text = await hint.innerText();
    // Shows a heat temperature, and names the first-step target it solves for.
    expect(text).toMatch(/\d+\s*°?C/i);
    expect(text).toMatch(/63/);

    // Apply writes it into the step without throwing; the hint stays.
    await page.getByRole("button", { name: /^Apply$/ }).last().click();
    await expect(hint).toBeVisible();
  });
});

test.describe("Recipe — BU:GU tile (#32)", () => {
  test("a styled recipe shows a numeric BU:GU on the read view", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openRecipeByName("Cascade Pale Ale");

    await app.recipe.buGuTile().waitFor();
    const value = num(await app.recipe.buGuText());
    // A balanced pale ale sits around 0.5–0.9; just assert it computed.
    expect(value).toBeGreaterThan(0);
  });
});

test.describe("Numeric fields — clearing no longer snaps to 0", () => {
  test("emptying a water-ion field leaves it blank, not '0'", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();

    const ion = page
      .locator('[data-testid="water-chemistry"] input[type="number"]')
      .first();
    await ion.scrollIntoViewIfNeeded();
    await ion.fill("50");
    await ion.fill(""); // select-all + delete
    // Old behaviour re-rendered the field as "0" mid-edit; now it stays empty.
    await expect(ion).toHaveValue("");
  });
});

test.describe("Water chemistry — suggest additions (#10)", () => {
  test("suggesting salts moves RO water closer to a Burton target", async ({ page }) => {
    const app = new App(page);
    await app.go("Library");
    await app.library.importSamples();
    await app.library.openFirstRecipe();

    // Start from RO (all zeros) aiming at Burton (very high Ca / SO4).
    await app.recipe.setWaterSource("ro");
    await app.recipe.setWaterTarget("burton");
    const before = await app.recipe.offTargetIonCount();
    expect(before).toBeGreaterThan(0);

    await app.recipe.suggestWaterAdditions();

    // The suggested salts must reduce how many ions read off-target.
    const after = await app.recipe.offTargetIonCount();
    expect(after).toBeLessThan(before);
  });
});
