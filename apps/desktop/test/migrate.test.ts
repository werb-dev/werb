import { describe, it, expect } from "vitest";
import {
  MemoryBackend,
  copyKeysToBackend,
  migrateBackend,
} from "../src/storage/index.ts";

describe("migrateBackend", () => {
  it("copies werb.* keys from source to target when target lacks them", async () => {
    const source = new MemoryBackend({
      "werb.recipes": "{recipes}",
      "werb.equipment": "{equipment}",
    });
    const target = new MemoryBackend();

    const copied = await migrateBackend(source, target);

    expect(copied).toBe(2);
    expect(await target.read("werb.recipes")).toBe("{recipes}");
    expect(await target.read("werb.equipment")).toBe("{equipment}");
  });

  it("leaves keys already present in target untouched", async () => {
    const source = new MemoryBackend({ "werb.recipes": "from-source" });
    const target = new MemoryBackend({ "werb.recipes": "from-target" });

    const copied = await migrateBackend(source, target);

    expect(copied).toBe(0);
    expect(await target.read("werb.recipes")).toBe("from-target");
  });

  it("ignores keys outside the werb.* prefix", async () => {
    const source = new MemoryBackend({
      "werb.recipes": "carry",
      "other.app": "leave-me",
    });
    const target = new MemoryBackend();

    await migrateBackend(source, target);

    expect(await target.read("werb.recipes")).toBe("carry");
    expect(await target.read("other.app")).toBeNull();
  });

  it("is idempotent — running twice copies nothing the second time", async () => {
    const source = new MemoryBackend({ "werb.recipes": "data" });
    const target = new MemoryBackend();

    const first = await migrateBackend(source, target);
    const second = await migrateBackend(source, target);

    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("handles an empty source as a no-op", async () => {
    const source = new MemoryBackend();
    const target = new MemoryBackend();
    expect(await migrateBackend(source, target)).toBe(0);
  });

  it("carries multi-key structures (sessions, hop-added, carbonation)", async () => {
    // Real-world shape: recipes blob, equipment blob, per-recipe sessions,
    // per-step hop-added marks, per-recipe carbonation form state.
    const source = new MemoryBackend({
      "werb.recipes": "[]",
      "werb.equipment": "{}",
      "werb.session.r-1": "{...}",
      "werb.session.r-2": "{...}",
      "werb.brew.s-1.hopAdded.step-3": "[0,1]",
      "werb.carbonation.My IPA": "{vols:2.4}",
    });
    const target = new MemoryBackend();

    const copied = await migrateBackend(source, target);
    expect(copied).toBe(6);

    const targetKeys = (await target.list("werb.")).sort();
    expect(targetKeys).toEqual((await source.list("werb.")).sort());
  });
});

describe("copyKeysToBackend", () => {
  it("overwrites every werb.* key in target with the source value", async () => {
    const source = new MemoryBackend({
      "werb.recipes": "fresh",
      "werb.equipment": "fresh",
    });
    const target = new MemoryBackend({
      "werb.recipes": "stale",
      "werb.equipment": "stale",
    });

    const copied = await copyKeysToBackend(source, target);

    expect(copied).toBe(2);
    expect(await target.read("werb.recipes")).toBe("fresh");
    expect(await target.read("werb.equipment")).toBe("fresh");
  });

  it("leaves keys outside werb.* untouched on the target", async () => {
    const source = new MemoryBackend({ "werb.recipes": "new" });
    const target = new MemoryBackend({
      "werb.recipes": "old",
      "local.sync.github": "{\"token\":\"keep-me\"}",
    });

    await copyKeysToBackend(source, target);

    expect(await target.read("werb.recipes")).toBe("new");
    expect(await target.read("local.sync.github")).toBe(
      "{\"token\":\"keep-me\"}",
    );
  });

  it("doesn't delete target keys that aren't in source", async () => {
    const source = new MemoryBackend({ "werb.recipes": "from-source" });
    const target = new MemoryBackend({
      "werb.equipment": "only-on-target",
    });

    await copyKeysToBackend(source, target);

    // Push semantics: source wins for keys it has, target keeps the rest.
    expect(await target.read("werb.recipes")).toBe("from-source");
    expect(await target.read("werb.equipment")).toBe("only-on-target");
  });

  it("reports progress through the callback", async () => {
    const source = new MemoryBackend({
      "werb.a": "1",
      "werb.b": "2",
      "werb.c": "3",
    });
    const target = new MemoryBackend();
    const events: Array<[number, number]> = [];
    await copyKeysToBackend(source, target, (done, total) =>
      events.push([done, total]),
    );
    // Initial event reports total + 0 done; one event per key written.
    expect(events[0]).toEqual([0, 3]);
    expect(events[events.length - 1]).toEqual([3, 3]);
  });
});
