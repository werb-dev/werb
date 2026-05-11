import type { StorageBackend } from "./backend.ts";

/**
 * StorageBackend backed by `window.localStorage`. Synchronous under the
 * hood, but exposes the async StorageBackend surface so callers can be
 * agnostic about whether they're hitting localStorage, a cloud sync, or
 * a Tauri filesystem.
 *
 * Implements `readSync` so hooks hydrate without a loading flicker —
 * the common case in the desktop app where everything lives in
 * localStorage today.
 */
export const localStorageBackend: StorageBackend = {
  readSync(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      // Storage disabled (private mode, quota error on read) — surface
      // as "missing" rather than crashing the app.
      return null;
    }
  },
  async read(key) {
    return this.readSync!(key);
  },
  async write(key, value) {
    localStorage.setItem(key, value);
  },
  async delete(key) {
    localStorage.removeItem(key);
  },
  async list(prefix) {
    return this.listSync!(prefix);
  },
  listSync(prefix) {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(prefix)) out.push(k);
    }
    return out;
  },
};
