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
