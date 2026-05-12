#!/usr/bin/env node
/**
 * Capture the README screenshots in one shot.
 *
 * Boots `vite preview` against the built bundle, drives a headless
 * Chromium through the main four screens (Library, Recipe, Brew,
 * Journal), and writes PNGs to docs/screenshots/. Each capture
 * walks the actual UI — same buttons a brewer would click — so the
 * shots stay honest if the layout drifts.
 *
 * Re-run via `pnpm screenshots` from the repo root. Build is left to
 * the caller; if dist/ is stale, the screenshots will be too.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, "..");
const ROOT = join(APP_DIR, "..", "..");
const OUT_DIR = join(ROOT, "docs", "screenshots");
const PORT = 4173; // vite preview default
const BASE = `http://localhost:${PORT}/`;

// Tablet-portrait viewport reads more like how brewers actually use
// the app than a desktop window. 1280×800 produces shots that feel
// half-empty for sections that grew up wanting a phone width.
const VIEWPORT = { width: 1024, height: 1280 };

async function waitForServerReady(child, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`vite preview didn't print "Local:" within ${timeoutMs} ms`));
    }, timeoutMs);
    const onData = (chunk) => {
      const s = chunk.toString();
      process.stdout.write(`[preview] ${s}`);
      if (/Local:/i.test(s)) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        // small grace period for the server to actually accept connections
        setTimeout(resolve, 250);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (c) => process.stderr.write(`[preview] ${c}`));
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`vite preview exited early with code ${code}`));
    });
  });
}

async function capture(page, name) {
  const path = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  console.log(`✓ ${name}.png`);
}

/**
 * Wait long enough that any CSS transitions, font loads, and pending
 * state updates have settled. Cheap insurance against half-rendered
 * shots — a few hundred ms after the network goes idle.
 */
async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Boot the production bundle via vite preview. Production is what
  // a brewer actually sees and what we promise the README image of.
  const preview = spawn(
    "pnpm",
    ["--filter", "@werb/desktop", "preview", "--port", String(PORT), "--strictPort"],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let exitCode = 0;
  try {
    await waitForServerReady(preview);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2, // crisp retina-class PNGs
      colorScheme: "dark",
    });
    const page = await context.newPage();

    // ─── 1. Library (empty → onboarding) ─────────────────────────────
    // Capture the onboarding state first — that's what new users land
    // on. We'll move past it to the populated state below.
    await page.goto(BASE);
    await settle(page);
    await page.getByRole("button", { name: /Werb's onboarding/i }).first().click().catch(() => {});
    // Click "Import samples" — most reliable seeding path. Falls back
    // to importing bundled samples if available.
    await page.getByRole("button", { name: /Import samples/i }).click();
    // Wait for at least one RecipeCard to render.
    await page.waitForSelector("button[class*='rounded-xl bg-surface']", { timeout: 10_000 });
    await settle(page);
    await capture(page, "library");

    // ─── 2. Recipe ──────────────────────────────────────────────────
    // Click the recipe-name h2 inside the first card. Clicking the
    // card directly would risk hitting the dup/delete buttons in the
    // top-right corner; the h2 propagates to the onSelect button.
    await page.locator("ul.grid li h2").first().click();
    // "Water volumes" is always rendered (computed defaults if no
    // equipment profile) — a more reliable wait target than
    // "Hop additions" which depends on the recipe having hops.
    await page.waitForSelector("text=Water volumes", { timeout: 10_000 });
    await settle(page);
    await capture(page, "recipe");

    // ─── 3. Brew ─────────────────────────────────────────────────────
    // Start the brew, then start the first step so the active card
    // shows a real countdown.
    await page
      .getByRole("button", { name: /Start brewing/i })
      .first()
      .click();
    // Brew screen's NoSession state has another "Start brewing"; click
    // again to actually open the session.
    await page
      .getByRole("button", { name: /Start brewing/i })
      .first()
      .click()
      .catch(() => {
        // already in live session — no second button
      });
    await page.waitForSelector("text=Timeline", { timeout: 10_000 });

    // Click the first "Start" button in the timeline.
    const startBtn = page.getByRole("button", { name: /^Start$/ }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      // Let the countdown tick visibly.
      await page.waitForTimeout(2_500);
    }
    await settle(page);
    await capture(page, "brew");

    // ─── 4. Journal ─────────────────────────────────────────────────
    // Back out of the brew (it's the only screen with no DevNav), then
    // navigate to the Journal via the floating pill. The header back
    // button's accessible name is just "Recipe" — the ← span is
    // aria-hidden so it's stripped from the computed name.
    await page.getByRole("button", { name: /^Recipe$/i }).click();
    await page.waitForSelector("text=Water volumes", { timeout: 10_000 });
    await page
      .getByRole("button", { name: /^Journal$/i })
      .first()
      .click();
    await page.waitForSelector("h1:has-text('Journal')", { timeout: 10_000 });
    await settle(page);
    await capture(page, "journal");

    await browser.close();
  } catch (err) {
    console.error("Screenshot capture failed:", err);
    exitCode = 1;
  } finally {
    preview.kill("SIGINT");
    // Give the child a moment to release the port before the process
    // exits, otherwise the next run can race.
    await new Promise((r) => setTimeout(r, 200));
  }

  process.exit(exitCode);
}

main();
