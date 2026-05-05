import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite config tuned for Tauri 2: fixed dev port, no auto-clear of stderr,
// HMR over the host Tauri injects, and exclusion of the Rust build dir from
// the file watcher (would otherwise trigger reloads on every cargo build).
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
