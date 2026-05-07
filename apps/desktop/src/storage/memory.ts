import type { StorageBackend } from "./backend.ts";

/**
 * In-memory StorageBackend. Each instance owns its own Map — no cross-
 * test pollution unless callers explicitly share an instance.
 *
 * Used for tests (drop-in replacement for localStorage with no cleanup
 * dance) and as a building block for cache layers in front of slower
 * cloud backends.
 *
 * Implements `readSync` since the data is always in-process.
 */
export class MemoryBackend implements StorageBackend {
  private readonly store: Map<string, string>;

  constructor(initial?: Record<string, string>) {
    this.store = new Map(Object.entries(initial ?? {}));
  }

  readSync(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  async read(key: string): Promise<string | null> {
    return this.readSync(key);
  }

  async write(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
}
