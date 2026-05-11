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

/**
 * Snapshot every `werb.*` key into a serializable bundle suitable for
 * a backup file. Strings stay as-is (keeps each blob's original
 * shape — recipes JSON, equipment JSON, etc.) so the backup is human-
 * inspectable.
 */
export interface DataSnapshot {
  /** Snapshot schema version. Bump on breaking changes. */
  schema_version: 1;
  /** ISO timestamp when the snapshot was taken. */
  exported_at: string;
  /** Backend keys → their stored value, both strings. */
  data: Record<string, string>;
}

export async function snapshotBackend(
  backend: StorageBackend,
): Promise<DataSnapshot> {
  const keys = await backend.list("werb.");
  const data: Record<string, string> = {};
  for (const key of keys) {
    const value = await backend.read(key);
    if (value !== null) data[key] = value;
  }
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    data,
  };
}

/**
 * Restore a previously-exported snapshot into `target`. Overwrites
 * matching keys. Throws if the snapshot's schema_version is unknown
 * so the caller can surface a clear error.
 *
 * Only writes keys under the `werb.` namespace — anything else in the
 * file is ignored, so a backup can never inject unrelated keys (e.g.
 * a fake sync token under local.sync.*) into your storage.
 */
export async function restoreSnapshot(
  backend: StorageBackend,
  snapshot: DataSnapshot,
): Promise<number> {
  if (snapshot.schema_version !== 1) {
    throw new Error(
      `Unsupported backup schema version: ${snapshot.schema_version}. ` +
        `This version of Werb only understands schema_version 1.`,
    );
  }
  let count = 0;
  for (const [key, value] of Object.entries(snapshot.data ?? {})) {
    if (!key.startsWith("werb.")) continue;
    await backend.write(key, value);
    count++;
  }
  return count;
}

/**
 * Delete every `werb.*` key from the backend. Keys outside that
 * namespace (sync config, unit preferences) are left alone — the
 * brewer can wipe their data without also losing their preferences.
 *
 * Returns the number of keys deleted.
 */
export async function clearWerbData(backend: StorageBackend): Promise<number> {
  const keys = await backend.list("werb.");
  for (const key of keys) {
    await backend.delete(key);
  }
  return keys.length;
}
