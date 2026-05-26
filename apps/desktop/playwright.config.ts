import { defineConfig, devices } from "@playwright/test";

/**
 * Behavioral smoke suite — drives the production bundle through
 * Chromium and asserts on interaction outcomes.
 *
 * Production bundle ≠ dev server: catches regressions that only show
 * up after Vite chunking + tree-shaking (e.g. dropped Tailwind class
 * variants, lazy-import races) which a `vite dev` run would mask.
 */
export default defineConfig({
  testDir: "./test/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:4174/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production bundle (`vite preview`) must already be built — the
    // `e2e` package script chains `pnpm build` before invoking
    // `playwright test`. Saves ~20 s on each run vs. building inside
    // the webServer hook.
    //
    // Port 4174 deliberately differs from vite preview's default 4173 —
    // the existing `pnpm screenshots` step uses 4173 and may leave the
    // port bound briefly after it exits in CI, racing with our launch.
    command: "pnpm preview --port 4174 --strictPort",
    url: "http://localhost:4174/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
