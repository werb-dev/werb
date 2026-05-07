import type { StorageBackend } from "./backend.ts";

/**
 * StorageBackend backed by the Origin Private File System (OPFS).
 *
 *   navigator.storage.getDirectory() → FileSystemDirectoryHandle
 *
 * Persistent, per-origin, sandboxed storage available in modern
 * browsers. Each `key` becomes a file in the root directory; the value
 * is the file's text contents.
 *
 * Async only — OPFS has no synchronous read API, so hooks built on
 * `usePersistedJson` will see one render with the fallback value
 * before the file system answers. Acceptable for a web build; the
 * desktop app continues to use localStorage where readSync is free.
 *
 * Why this isn't `class OpfsBackend`: the IO is decoupled from the
 * navigator binding so tests can drive it with a fake directory
 * handle. `browserOpfsBackend()` is the default factory that wires
 * the real `navigator.storage` root.
 */

/**
 * Build an OPFS-backed StorageBackend over the given root directory.
 * The root is provided as a Promise so the factory can defer the
 * `navigator.storage.getDirectory()` call until first use without
 * making the entire backend itself a Promise.
 */
export function opfsBackend(
  rootPromise: Promise<FileSystemDirectoryHandle>,
): StorageBackend {
  // Cache the resolved root so repeated reads/writes don't re-await the
  // same promise. Errors propagate on first use.
  let cachedRoot: FileSystemDirectoryHandle | null = null;
  async function root(): Promise<FileSystemDirectoryHandle> {
    if (cachedRoot) return cachedRoot;
    cachedRoot = await rootPromise;
    return cachedRoot;
  }

  return {
    async read(key) {
      try {
        const dir = await root();
        const handle = await dir.getFileHandle(key);
        const file = await handle.getFile();
        return await file.text();
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async write(key, value) {
      const dir = await root();
      const handle = await dir.getFileHandle(key, { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(value);
      } finally {
        await writable.close();
      }
    },
    async delete(key) {
      try {
        const dir = await root();
        await dir.removeEntry(key);
      } catch (err) {
        if (isNotFound(err)) return;
        throw err;
      }
    },
    async list(prefix) {
      const dir = await root();
      const names: string[] = [];
      // FileSystemDirectoryHandle is an async iterable of [name, handle]
      // entries. The iterator type isn't part of older lib.dom.d.ts, but
      // every browser implementation exposes it the same way.
      const iter = (dir as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries();
      for await (const [name] of iter) {
        if (name.startsWith(prefix)) names.push(name);
      }
      return names;
    },
  };
}

/** Default factory: bind to the real OPFS root for this origin. */
export function browserOpfsBackend(): StorageBackend {
  return opfsBackend(navigator.storage.getDirectory());
}

/**
 * Runtime probe — true when the current environment exposes OPFS.
 * Use this at the provider site to pick OPFS over localStorage on the
 * web, while leaving Tauri/desktop builds on localStorage.
 */
export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

function isNotFound(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotFoundError";
}
