import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import {
  browserOpfsBackend,
  isOpfsAvailable,
  localStorageBackend,
  StorageProvider,
  type StorageBackend,
} from "./storage/index.ts";

// Pick the best available StorageBackend at boot. OPFS persists across
// reloads, isn't bound by localStorage's 5-10 MB quota, and is the
// natural fit when we ship a non-Tauri web build. localStorage is the
// fallback for any environment without OPFS — same shape, less room.
const backend: StorageBackend = isOpfsAvailable()
  ? browserOpfsBackend()
  : localStorageBackend;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StorageProvider backend={backend}>
      <App />
    </StorageProvider>
  </StrictMode>,
);
