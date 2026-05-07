import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest config for the desktop app. Uses happy-dom so hook tests
// (renderHook) and storage-backed tests (localStorage, FileReader) work
// without the heavier jsdom. The Vite dev config in vite.config.ts has
// Tauri-specific server settings we don't want to inherit during tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: false,
    // Reset DOM/localStorage between every test so storage-backed hooks
    // start from a known empty state in each `it`.
    restoreMocks: true,
    setupFiles: ["./test/setup.ts"],
  },
});
