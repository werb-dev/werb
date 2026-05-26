import type { Page } from "@playwright/test";

/**
 * Tiny page-object helpers for the e2e smoke suite. Each method
 * resolves a data-testid the screen exposes — see the `data-testid`
 * attributes sprinkled in the source. Keep the wrappers thin: they're
 * here so smokes don't drown in selector noise, not as a UI DSL.
 */

export class App {
  constructor(readonly page: Page) {}

  async start() {
    await this.page.goto("/");
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForTimeout(200);
  }

  async go(tab: "Library" | "Journal" | "Equipment" | "Settings") {
    await this.page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") }).first().click();
    await this.page.waitForTimeout(200);
  }

  equipment = new EquipmentPage(this.page);
  library = new LibraryPage(this.page);
  recipe = new RecipePage(this.page);
}

class EquipmentPage {
  constructor(readonly page: Page) {}

  /** Empty-state CTA when no profile exists yet. */
  async createFirstProfile() {
    await this.page.getByRole("button", { name: /Create your first profile/i }).click();
    await this.page.locator('[data-testid="mash-mode-select"]').waitFor();
  }

  /** Sidebar: re-select the first listed profile (forces re-mount + load). */
  async openFirstProfile() {
    await this.page.locator("aside button").first().click();
    await this.page.locator('[data-testid="mash-mode-select"]').waitFor();
  }

  async setMashMode(mode: "classic" | "biab") {
    await this.page.locator('[data-testid="mash-mode-select"]').selectOption(mode);
    await this.page.waitForTimeout(250);
  }

  async getMashMode(): Promise<string> {
    return this.page.locator('[data-testid="mash-mode-select"]').inputValue();
  }

  async openQuickStart() {
    const wizard = this.page.locator('[data-testid="quick-start"]');
    const isOpen = await wizard.evaluate((el: HTMLDetailsElement) => el.open);
    if (!isOpen) {
      await wizard.locator("summary").click();
    }
    await this.page.locator('[data-testid="quick-start-apply"]').waitFor();
  }

  async pickSetupType(t: "three_vessel" | "two_vessel" | "biab") {
    await this.page.locator(`[data-testid="setup-type-${t}"]`).click();
  }

  async applyQuickStart() {
    await this.page.locator('[data-testid="quick-start-apply"]').click();
    await this.page.waitForTimeout(400);
  }

  /** Make this profile the active one so recipe calcs use it. */
  async setActive() {
    const btn = this.page.getByRole("button", { name: /^Set as active$|^Set active$/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await this.page.waitForTimeout(200);
    }
  }
}

class LibraryPage {
  constructor(readonly page: Page) {}

  /** Seed the bundled samples. No-ops if samples are already loaded. */
  async importSamples() {
    const btn = this.page.getByRole("button", { name: /Import samples/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await this.page.waitForTimeout(2500);
    }
  }

  /** Create a new empty recipe and save it. Lands on the recipe view. */
  async newEmptyRecipe(name: string) {
    await this.page.getByRole("button", { name: /\+\s*New recipe/i }).click();
    await this.page.waitForTimeout(400);
    await this.page.locator("input[type='text']").first().fill(name);
    await this.page.getByRole("button", { name: /Save changes/i }).click();
    await this.page.waitForSelector('[data-testid="water-volumes"]', { timeout: 10000 });
  }

  /** Open the first recipe card. */
  async openFirstRecipe() {
    await this.page.locator("li h2").first().click();
    await this.page.waitForSelector('[data-testid="water-volumes"]', { timeout: 10000 });
  }
}

class RecipePage {
  constructor(readonly page: Page) {}

  spargeText() {
    return this.page.locator('[data-testid="water-volume-sparge"]').innerText();
  }

  async setWaterSource(key: string) {
    await this.page.locator('[data-testid="water-chemistry"]').scrollIntoViewIfNeeded();
    await this.page.locator('[data-testid="water-source-select"]').selectOption(key);
    await this.page.waitForTimeout(150);
  }

  async setWaterTarget(key: string) {
    await this.page.locator('[data-testid="water-target-select"]').selectOption(key);
    await this.page.waitForTimeout(250);
  }

  /** How many ion tiles are flagged off-target by the result strip. */
  async offTargetIonCount(): Promise<number> {
    return this.page
      .locator('[data-testid="water-result-strip"] [data-off-target="true"]')
      .count();
  }

  yeastText() {
    return this.page.locator('[data-testid="yeast-pitch"]').innerText();
  }
}
