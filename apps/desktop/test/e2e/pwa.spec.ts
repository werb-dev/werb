import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * Service worker scope. The mdBook docs are deployed under the app's
 * `docs/`, inside the service worker's scope; they must load as docs,
 * not as the app shell.
 */

const docsDir = fileURLToPath(new URL("../../dist/docs/", import.meta.url));
const probe = `${docsDir}e2e-probe.html`;

test.beforeAll(() => {
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(probe, "<!doctype html><title>Werb docs probe</title><h1>Docs probe</h1>");
});

test.afterAll(() => {
  rmSync(probe, { force: true });
});

test("docs pages load once the app's service worker controls the site", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await page.goto("/docs/e2e-probe.html");
  await expect(page).toHaveTitle("Werb docs probe");
});
