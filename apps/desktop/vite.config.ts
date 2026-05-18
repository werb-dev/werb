import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Build-time stamping. These are baked into the bundle at config
// load and surfaced through the Settings footer so a bug report can
// quote an exact commit. `git` failures (Docker build without a
// .git, shallow checkout, …) degrade to "unknown" rather than
// breaking the build.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")) as {
  version: string;
};
function gitCommit(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    // -dirty suffix when the working tree has uncommitted changes,
    // so a tester's local build is visibly distinct from a clean one.
    const dirty = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim().length > 0;
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}
const COMMIT = gitCommit();
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Vite config tuned for Tauri 2: fixed dev port, no auto-clear of stderr,
// HMR over the host Tauri injects, and exclusion of the Rust build dir from
// the file watcher (would otherwise trigger reloads on every cargo build).
//
// `base` is read from VITE_BASE so a single config covers three targets:
//   • local dev / Tauri build:  base="/"  (default)
//   • GitHub Pages deploy:      base="/werb/"  (CI sets VITE_BASE=/werb/)
//   • custom domain on Pages:   base="/"  (CI sets VITE_BASE=/)
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(COMMIT),
    __APP_BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  plugins: [
    react(),
    tailwindcss(),
    // PWA: emits a Web App Manifest + Workbox service worker that
    // precaches the app shell (HTML, JS, CSS, fonts, icons, the
    // BeerXML wasm chunk). The app already persists everything to
    // OPFS / localStorage, so once the shell is cached it runs
    // entirely offline — useful in brew mode by the kettle.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
      ],
      manifest: {
        name: "Werb",
        short_name: "Werb",
        description:
          "File-driven homebrewing — recipes in, brew sessions out. BeerJSON / BeerXML compatible.",
        theme_color: "#1a0e13",
        background_color: "#1a0e13",
        display: "standalone",
        // start_url is base-relative so it works on both root- and
        // subpath-served deploys.
        start_url: ".",
        scope: ".",
        icons: [
          // "any" purpose — rounded-rect with transparent corners so
          // the OS-rendered bg (light or dark) shows through cleanly
          // outside the rounded shape.
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          // "maskable" purpose — full-bleed dark background so Android
          // adaptive-icon masks (circle, squircle, …) can crop to any
          // shape without exposing transparency.
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The wasm chunk is past the default 2 MB inlining limit;
        // bumping so it's precached alongside everything else.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,wasm,woff,woff2,png,svg,webmanifest}"],
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
