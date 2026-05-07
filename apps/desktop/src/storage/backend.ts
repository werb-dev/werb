/**
 * Storage backend port.
 *
 * Hooks and data modules read/write through this interface instead of
 * touching localStorage / Tauri-fs / Drive APIs directly. Each backend
 * implementation is a small adapter — a few async methods over whatever
 * the underlying store is. This keeps cloud-storage work (Drive, GitHub,
 * OPFS) cleanly separable from the rest of the codebase.
 *
 * Contract:
 *   • `read` returns null for missing keys (not an error).
 *   • `write` is upsert — overwrites whatever was there.
 *   • `delete` is idempotent — deleting a missing key is fine.
 *   • `list(prefix)` returns the keys whose name starts with `prefix`,
 *     in unspecified order. An empty prefix returns every key.
 *
 * `readSync` is an optional optimization: backends that can answer
 * synchronously (localStorage, in-memory) implement it so React hooks
 * can hydrate on first render without a loading flicker. Cloud backends
 * leave it undefined — their hooks expose a `loading` flag instead.
 */
export interface StorageBackend {
  read(key: string): Promise<string | null>;
  readSync?(key: string): string | null;
  write(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
