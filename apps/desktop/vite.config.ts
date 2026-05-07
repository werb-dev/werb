import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

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
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
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
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          // Maskable variant for Android adaptive icons. Reusing the
          // same source file — works as long as the icon's main
          // content sits inside its center 80%.
          {
            src: "icons/icon-512.png",
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
