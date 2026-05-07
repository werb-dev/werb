import { describe, it, expect } from "vitest";
import {
  localStorageBackend,
  MemoryBackend,
  type StorageBackend,
} from "../src/storage/index.ts";

/**
 * Contract test: any StorageBackend must satisfy these assertions.
 * Adding a new backend (Drive, GitHub, OPFS, …) should re-run this same
 * suite against the new adapter so we catch behavior drift before it
 * reaches the hooks.
 */
function describeBackend(name: string, factory: () => StorageBackend) {
  describe(`StorageBackend contract — ${name}`, () => {
    it("read returns null for missing keys", async () => {
      const b = factory();
      expect(await b.read("nope")).toBeNull();
    });

    it("write then read round-trips", async () => {
      const b = factory();
      await b.write("k", "value");
      expect(await b.read("k")).toBe("value");
    });

    it("write is upsert — overwrites existing values", async () => {
      const b = factory();
      await b.write("k", "first");
      await b.write("k", "second");
      expect(await b.read("k")).toBe("second");
    });

    it("delete removes the key", async () => {
      const b = factory();
      await b.write("k", "v");
      await b.delete("k");
      expect(await b.read("k")).toBeNull();
    });

    it("delete is idempotent on missing keys", async () => {
      const b = factory();
      await expect(b.delete("nope")).resolves.toBeUndefined();
    });

    it("list filters by prefix", async () => {
      const b = factory();
      await b.write("werb.recipes", "{}");
      await b.write("werb.equipment", "{}");
      await b.write("other.thing", "{}");

      const werb = await b.list("werb.");
      expect(werb.sort()).toEqual(["werb.equipment", "werb.recipes"]);

      const all = await b.list("");
      expect(all.length).toBeGreaterThanOrEqual(3);
    });

    it("readSync, when present, agrees with async read", async () => {
      const b = factory();
      if (!b.readSync) return; // optional
      await b.write("k", "v");
      expect(b.readSync("k")).toBe(await b.read("k"));
      expect(b.readSync("missing")).toBeNull();
    });

    it("read survives an empty string value", async () => {
      const b = factory();
      await b.write("k", "");
      expect(await b.read("k")).toBe("");
    });
  });
}

describeBackend("MemoryBackend", () => new MemoryBackend());

// localStorage is shared across the test run; wipe before each spec by
// hand since this suite intentionally bypasses the global setup.ts hook
// (which clears via afterEach, not before).
describeBackend("localStorageBackend", () => {
  localStorage.clear();
  return localStorageBackend;
});
