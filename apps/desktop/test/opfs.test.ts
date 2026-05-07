import { describe, it, expect } from "vitest";
import { opfsBackend } from "../src/storage/index.ts";
import { describeBackend } from "./storage-contract.ts";

/**
 * Minimal in-memory fake of the FileSystemDirectoryHandle / FileHandle /
 * Writable triplet, just rich enough to exercise the OPFS adapter. The
 * real browser implementation is identical contract-wise; we don't need
 * a headless browser to validate the adapter's logic.
 *
 * The fake is intentionally rough — `getFile()` returns an object with a
 * single `.text()` method, `createWritable()` returns a tiny streaming
 * shim, and `entries()` yields whatever's in the map. Any missing methods
 * would surface immediately as a TypeError when the adapter calls them.
 */
function makeFakeRoot(): FileSystemDirectoryHandle {
  const files = new Map<string, string>();

  const fake = {
    async getFileHandle(
      name: string,
      options?: { create?: boolean },
    ): Promise<FileSystemFileHandle> {
      if (!files.has(name)) {
        if (!options?.create) {
          throw new DOMException(
            `No file named "${name}"`,
            "NotFoundError",
          );
        }
        files.set(name, "");
      }
      return {
        async getFile() {
          return {
            async text() {
              return files.get(name) ?? "";
            },
          };
        },
        async createWritable() {
          let buffer = "";
          return {
            async write(chunk: string) {
              buffer = chunk;
            },
            async close() {
              files.set(name, buffer);
            },
          };
        },
      } as unknown as FileSystemFileHandle;
    },
    async removeEntry(name: string) {
      if (!files.has(name)) {
        throw new DOMException(`No file named "${name}"`, "NotFoundError");
      }
      files.delete(name);
    },
    async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
      for (const name of files.keys()) {
        yield [name, {} as FileSystemHandle];
      }
    },
  };

  return fake as unknown as FileSystemDirectoryHandle;
}

// Run the full StorageBackend contract against the OPFS adapter via the
// fake root. This is the same suite that runs against MemoryBackend and
// localStorageBackend in storage.test.ts — a Drive / GitHub adapter
// would do the same and inherit identical guarantees.
describeBackend("opfsBackend (fake root)", () =>
  opfsBackend(Promise.resolve(makeFakeRoot())),
);

describe("opfsBackend specifics", () => {
  it("read returns null on NotFoundError, surfaces other errors", async () => {
    const root = makeFakeRoot();
    const backend = opfsBackend(Promise.resolve(root));
    expect(await backend.read("missing")).toBeNull();
  });

  it("delete is idempotent — NotFoundError is swallowed", async () => {
    const backend = opfsBackend(Promise.resolve(makeFakeRoot()));
    await expect(backend.delete("never-existed")).resolves.toBeUndefined();
  });

  it("memoizes the root handle so the promise resolves once", async () => {
    let resolveCount = 0;
    const rootPromise = new Promise<FileSystemDirectoryHandle>((res) => {
      resolveCount++;
      res(makeFakeRoot());
    });
    const backend = opfsBackend(rootPromise);
    await backend.write("a", "1");
    await backend.write("b", "2");
    await backend.read("a");
    expect(resolveCount).toBe(1);
  });
});
