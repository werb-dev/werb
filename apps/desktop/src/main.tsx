import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { localStorageBackend, StorageProvider } from "./storage/index.ts";

// Single StorageBackend wired at the root. localStorage is the only
// concrete adapter shipping today; cloud adapters (Drive / GitHub /
// OPFS) plug in here without changes to hooks or screens.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StorageProvider backend={localStorageBackend}>
      <App />
    </StorageProvider>
  </StrictMode>,
);
