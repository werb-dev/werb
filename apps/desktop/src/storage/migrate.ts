import type { StorageBackend } from "./backend.ts";

/**
 * Copy any `werb.*` keys from `source` into `target` that aren't
 * already there. Idempotent — keys present in `target` are left
 * untouched, so this is safe to run on every boot.
 *
 * Used to carry data forward when the active StorageBackend changes
 * (e.g. desktop dev users who had recipes/equipment in localStorage
 * before OPFS became the default).
 *
 * Returns the number of keys copied — caller can log it or surface a
 * one-time toast if useful.
 */
export async function migrateBackend(
  source: StorageBackend,
  target: StorageBackend,
): Promise<number> {
  const keys = await source.list("werb.");
  let copied = 0;
  for (const key of keys) {
    const existing = await target.read(key);
    if (existing !== null) continue;
    const value = await source.read(key);
    if (value === null) continue;
    await target.write(key, value);
    copied++;
  }
  return copied;
}

/**
 * Copy every `werb.*` key from `source` into `target`, overwriting any
 * existing entries. Used by the Push / Pull buttons in the sync UI
 * where the user explicitly wants one side's view to win.
 *
 * Returns the number of keys written. Reports progress via the
 * optional onProgress callback (current, total) — useful for the
 * long-running cloud-sync case where each write is a network round-
 * trip.
 *
 * Keys outside the `werb.` namespace (sync config, screen-local
 * preferences) are deliberately untouched.
 */
export async function copyKeysToBackend(
  source: StorageBackend,
  target: StorageBackend,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const keys = await source.list("werb.");
  let done = 0;
  onProgress?.(0, keys.length);
  for (const key of keys) {
    const value = await source.read(key);
    if (value !== null) await target.write(key, value);
    done++;
    onProgress?.(done, keys.length);
  }
  return done;
}
