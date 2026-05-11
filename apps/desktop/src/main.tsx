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
  migrateBackend,
  StorageProvider,
  type StorageBackend,
} from "./storage/index.ts";
import { migrateLegacySessionKeys } from "./hooks/useBrewSession.ts";
import { PreferencesProvider } from "./data/preferences.tsx";

// Pick the best available StorageBackend at boot. OPFS persists across
// reloads, isn't bound by localStorage's 5-10 MB quota, and is the
// natural fit when we ship a non-Tauri web build. localStorage is the
// fallback for any environment without OPFS — same shape, less room.
const backend: StorageBackend = isOpfsAvailable()
  ? browserOpfsBackend()
  : localStorageBackend;

const root = createRoot(document.getElementById("root")!);

async function boot() {
  // One-shot, idempotent migration: any werb.* key still living in
  // localStorage gets copied into OPFS if OPFS doesn't already have
  // it. Carries data forward for users (or developers) who had data
  // in localStorage before OPFS became the default. Cheap on a fresh
  // install (no source keys → no-op).
  if (backend !== localStorageBackend) {
    try {
      const copied = await migrateBackend(localStorageBackend, backend);
      if (copied > 0) console.info(`[storage] migrated ${copied} keys → OPFS`);
    } catch (err) {
      console.warn("[storage] migration failed; using OPFS as-is", err);
    }
  }

  // Per-session storage was originally keyed by recipe_id, which
  // capped each recipe at one historical brew. Rewrite any such
  // entries under their session.id key. Idempotent — already-migrated
  // entries cost one read and a key-equality check.
  try {
    const sessionsMigrated = await migrateLegacySessionKeys(backend);
    if (sessionsMigrated > 0) {
      console.info(`[storage] rewrote ${sessionsMigrated} sessions under their session.id`);
    }
  } catch (err) {
    console.warn("[storage] session-key migration failed", err);
  }

  root.render(
    <StrictMode>
      <StorageProvider backend={backend}>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </StorageProvider>
    </StrictMode>,
  );
}

void boot();
